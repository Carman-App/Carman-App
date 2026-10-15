import { Router, type Request } from "express";
import { z } from "zod";
import { kenyanPhoneSchema, objectIdSchema, PAYMENT_PURPOSES, paginationQuerySchema } from "@showrooms/shared";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { describeRoute } from "../../docs/openapi";
import { authenticate, authorize, requireAuth } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { safeEqual } from "../../utils/crypto";
import { handler, ok } from "../../utils/handler";
import { paginate } from "../../utils/slug";
import { audit, requestMeta } from "../audit/audit.service";
import { VehicleBoost } from "../boosts/boost.model";
import { getSettings } from "../settings/settings.service";
import { getSellerContext } from "../sellers/seller-context";
import { Subscription } from "../subscriptions/subscription.model";
import { Vehicle } from "../vehicles/vehicle.model";
import { Payment } from "./payment.model";
import { handleStkCallback, initiatePayment, reconcilePayment } from "./payments.service";

export function idempotencyKeyOf(req: Request): string | undefined {
  const key = req.get("idempotency-key");
  if (!key) return undefined;
  if (!/^[\w-]{8,100}$/.test(key)) throw AppError.badRequest("Idempotency-Key must be 8-100 letters, numbers, - or _");
  return key;
}

const retrySchema = z.object({
  purpose: z.enum(PAYMENT_PURPOSES),
  referenceId: objectIdSchema,
  phone: kenyanPhoneSchema,
});

export function paymentsRoutes(): Router {
  const router = Router();

  /** Safaricom → us. Authenticated by a secret token in the URL and optionally by source IP. */
  router.post("/mpesa/callback", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!env.MPESA_CALLBACK_TOKEN || !safeEqual(token, env.MPESA_CALLBACK_TOKEN)) {
      logger.warn({ ip: req.ip }, "M-Pesa callback with bad token");
      await audit({ action: "payment.callback_rejected", metadata: { reason: "token" } }, requestMeta(req));
      res.status(403).json({ ResultCode: 1, ResultDesc: "Rejected" });
      return;
    }
    if (env.MPESA_CALLBACK_IPS.length && !env.MPESA_CALLBACK_IPS.includes(req.ip ?? "")) {
      logger.warn({ ip: req.ip }, "M-Pesa callback from unexpected IP");
      await audit({ action: "payment.callback_rejected", metadata: { reason: "ip" } }, requestMeta(req));
      res.status(403).json({ ResultCode: 1, ResultDesc: "Rejected" });
      return;
    }
    const outcome = await handleStkCallback(req.body);
    logger.info({ outcome }, "M-Pesa callback processed");
    // Always acknowledge so Safaricom doesn't keep retrying; the outcome is recorded on the payment.
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  });

  router.use(authenticate);

  /** Retry paying for a subscription or boost that is still awaiting payment. */
  router.post(
    "/mpesa/stk-push",
    authorize("BROKER", "DEALER"),
    handler({ body: retrySchema }, async ({ req, res, body }) => {
      const ctx = await getSellerContext(requireAuth(req));
      let amountKes: number;
      let description: string;
      let accountReference: string;
      let refDoc: { paymentId?: unknown; save: () => Promise<unknown> };

      if (body.purpose === "SUBSCRIPTION") {
        const sub = await Subscription.findOne({ _id: body.referenceId, userId: ctx.billingUserId, status: "PENDING_PAYMENT" });
        if (!sub) throw AppError.notFound("Pending subscription");
        amountKes = sub.priceKes;
        description = `${sub.planName} plan`;
        accountReference = `SR-${sub.planCode}`;
        refDoc = sub;
      } else {
        const boost = await VehicleBoost.findOne({ _id: body.referenceId, userId: ctx.userId, status: { $in: ["PENDING_PAYMENT", "CANCELLED"] } });
        if (!boost) throw AppError.notFound("Pending promotion");
        const vehicle = await Vehicle.findById(boost.vehicleId).select("title shortId status");
        if (vehicle?.status !== "ACTIVE") throw AppError.conflict("Only live listings can be promoted");
        // Price comes from the package as configured now, never from the client.
        const pkg = (await getSettings()).boostPackages.find((p) => p.code === boost.packageCode);
        if (!pkg) throw AppError.notFound("Promotion package");
        boost.status = "PENDING_PAYMENT";
        boost.priceKes = pkg.priceKes;
        amountKes = pkg.priceKes;
        description = `${pkg.name}: ${vehicle.title}`.slice(0, 120);
        accountReference = `SR-${vehicle.shortId}`;
        refDoc = boost;
      }
      if (await Payment.exists({ purpose: body.purpose, referenceId: body.referenceId, status: { $in: ["INITIATED", "PENDING"] }, createdAt: { $gt: new Date(Date.now() - 2 * 60_000) } })) {
        throw AppError.conflict("A payment request was just sent to your phone. Check for the M-Pesa prompt.");
      }

      const payment = await initiatePayment({
        userId: ctx.userId,
        purpose: body.purpose,
        referenceId: body.referenceId,
        amountKes,
        phone: body.phone,
        description,
        accountReference,
        idempotencyKey: idempotencyKeyOf(req),
      });
      refDoc.paymentId = payment._id;
      await refDoc.save();
      ok(res, payment.toJSON(), undefined, 201);
    }),
  );

  router.get(
    "/me",
    handler({ query: paginationQuerySchema }, async ({ req, res, query }) => {
      const filter = { userId: requireAuth(req).userId };
      const [items, total] = await Promise.all([
        Payment.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
        Payment.countDocuments(filter),
      ]);
      ok(res, items.map((p) => p.toJSON()), paginate(query.page, query.limit, total));
    }),
  );

  /** Clients poll this after an STK push. It may ask Daraja directly if the callback is late. */
  router.get(
    "/:id",
    handler({ params: z.object({ id: objectIdSchema }) }, async ({ req, res, params }) => {
      let payment = await Payment.findOne({ _id: params.id, userId: requireAuth(req).userId });
      if (!payment) throw AppError.notFound("Payment");
      const ageMs = Date.now() - payment.createdAt.getTime();
      const lastQuery = payment.lastQueriedAt?.getTime() ?? 0;
      if (payment.status === "PENDING" && ageMs > 45_000 && Date.now() - lastQuery > 20_000) {
        payment = await reconcilePayment(params.id).catch(() => payment!);
      }
      ok(res, payment!.toJSON());
    }),
  );
  return router;
}

const tag = "Payments";
describeRoute({ method: "post", path: "/payments/mpesa/stk-push", tag, summary: "Re-send the M-Pesa prompt for a pending subscription or boost (supports Idempotency-Key)", auth: true, body: retrySchema });
describeRoute({ method: "post", path: "/payments/mpesa/callback", tag, summary: "Daraja STK callback (requires ?token=). Always acknowledged; activation only after verification." });
describeRoute({ method: "get", path: "/payments/me", tag, summary: "My payment history", auth: true, query: paginationQuerySchema });
describeRoute({ method: "get", path: "/payments/:id", tag, summary: "Payment status (poll after STK push)", auth: true });
