import mongoose, { type ClientSession, type Types } from "mongoose";
import { z } from "zod";
import { formatKes, toMsisdn, type PaymentPurpose } from "@showrooms/shared";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { services } from "../../services";
import { AppError } from "../../utils/app-error";
import { audit } from "../audit/audit.service";
import { VehicleBoost } from "../boosts/boost.model";
import { applyPromotion } from "../boosts/promotion";
import { notify } from "../notifications/notifications.service";
import { Subscription } from "../subscriptions/subscription.model";
import { Payment, type PaymentDoc } from "./payment.model";

export interface InitiateInput {
  userId: string;
  purpose: PaymentPurpose;
  referenceId: Types.ObjectId | string;
  amountKes: number;
  phone: string;
  description: string;
  accountReference: string;
  idempotencyKey?: string;
}

/** Starts an STK push. Amounts come from server-side plans/packages only. */
export async function initiatePayment(input: InitiateInput): Promise<PaymentDoc> {
  if (input.idempotencyKey) {
    const existing = await Payment.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey });
    if (existing) return existing;
  }

  let payment: PaymentDoc;
  try {
    payment = await Payment.create({
      userId: input.userId,
      purpose: input.purpose,
      referenceId: input.referenceId,
      amountKes: input.amountKes,
      phone: input.phone,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      status: "INITIATED",
    });
  } catch (err) {
    // Same idempotency key raced in from a double tap.
    if ((err as { code?: number }).code === 11000 && input.idempotencyKey) {
      return (await Payment.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey }))!;
    }
    throw err;
  }

  try {
    const res = await services().mpesa.stkPush({
      msisdn: toMsisdn(input.phone),
      amountKes: input.amountKes,
      accountReference: input.accountReference,
      description: input.description,
    });
    payment.status = "PENDING";
    payment.merchantRequestId = res.merchantRequestId;
    payment.checkoutRequestId = res.checkoutRequestId;
    await payment.save();
  } catch (err) {
    payment.status = "FAILED";
    payment.failureReason = err instanceof AppError ? err.message : "Could not reach M-Pesa. Please try again.";
    await payment.save();
    await cancelReference(payment);
    logger.warn({ err, paymentId: String(payment._id) }, "STK push failed");
    if (err instanceof AppError) throw err;
  }
  return payment;
}

async function cancelReference(payment: PaymentDoc, session?: ClientSession) {
  const model = payment.purpose === "SUBSCRIPTION" ? Subscription : VehicleBoost;
  // The reference may not be linked yet when the STK push itself fails.
  await (model as typeof Subscription).updateOne(
    { _id: payment.referenceId, status: "PENDING_PAYMENT", $or: [{ paymentId: payment._id }, { paymentId: null }] },
    { status: "CANCELLED" },
    { session },
  );
}

/** Activates what was paid for. Runs inside the same transaction that marks the payment successful. */
async function activateReference(payment: PaymentDoc, session: ClientSession): Promise<string> {
  const now = new Date();
  if (payment.purpose === "SUBSCRIPTION") {
    const sub = await Subscription.findById(payment.referenceId).session(session);
    if (!sub) throw new Error("Subscription missing for payment");
    // Renewing the same plan extends it; switching plans replaces the old one now.
    const current = await Subscription.findOne({ userId: sub.userId, status: "ACTIVE", endsAt: { $gt: now }, _id: { $ne: sub._id } }).sort({ endsAt: -1 }).session(session);
    let start = now;
    if (current && current.planCode === sub.planCode) start = current.endsAt!;
    else if (current) await Subscription.updateMany({ userId: sub.userId, status: "ACTIVE", _id: { $ne: sub._id } }, { status: "EXPIRED" }, { session });
    sub.status = "ACTIVE";
    sub.startsAt = start;
    sub.endsAt = new Date(start.getTime() + sub.periodDays * 86_400_000);
    await sub.save({ session });
    return `Your ${sub.planName} plan is active until ${sub.endsAt.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}.`;
  }

  const boost = await VehicleBoost.findById(payment.referenceId).session(session);
  if (!boost) throw new Error("Boost missing for payment");
  const window = await applyPromotion(boost.vehicleId, boost.type, boost.days, session);
  boost.status = "ACTIVE";
  boost.startsAt = window?.start ?? now;
  boost.endsAt = window?.end ?? new Date(now.getTime() + boost.days * 86_400_000);
  await boost.save({ session });
  return `Your listing is ${boost.type === "FEATURED" ? "featured" : "boosted"} for ${boost.days} days.`;
}

/**
 * The only path that marks a payment successful. The status flip is a
 * conditional update inside a transaction with the activation, so duplicate
 * callbacks, concurrent reconciliation and retries can apply it at most once.
 */
export async function finalizeSuccess(paymentId: Types.ObjectId | string, receipt: string | undefined, source: "callback" | "query" | "admin"): Promise<boolean> {
  const session = await mongoose.startSession();
  let message = "";
  let payment: PaymentDoc | null = null;
  try {
    await session.withTransaction(async () => {
      payment = await Payment.findOneAndUpdate(
        { _id: paymentId, status: { $in: ["INITIATED", "PENDING"] } },
        { $set: { status: "SUCCESS", resultCode: "0", completedAt: new Date(), ...(receipt ? { mpesaReceiptNumber: receipt } : {}) } },
        { returnDocument: "after", session },
      );
      if (!payment) return;
      message = await activateReference(payment, session);
    });
  } finally {
    await session.endSession();
  }
  if (!payment) return false;
  const p = payment as PaymentDoc;
  await audit({ action: "payment.succeeded", actorId: String(p.userId), entityType: "Payment", entityId: String(p._id), metadata: { source, amountKes: p.amountKes, receipt } });
  await notify(p.userId, { type: "PAYMENT_SUCCESS", title: `Payment received: ${formatKes(p.amountKes)}`, body: message, data: { paymentId: String(p._id), screen: "billing" }, email: true });
  return true;
}

async function finalizeFailure(payment: PaymentDoc, status: "FAILED" | "CANCELLED", reason: string, resultCode?: string): Promise<void> {
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ["INITIATED", "PENDING"] } },
    { $set: { status, failureReason: reason, resultCode, completedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) return;
  await cancelReference(updated);
  await notify(updated.userId, {
    type: "PAYMENT_FAILED",
    title: status === "CANCELLED" ? "Payment cancelled" : "Payment failed",
    body: `${updated.description}: ${reason}`,
    data: { paymentId: String(updated._id), screen: "billing" },
  });
}

const callbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string(),
      ResultCode: z.union([z.number(), z.string()]).transform(String),
      ResultDesc: z.string().default(""),
      CallbackMetadata: z
        .object({ Item: z.array(z.object({ Name: z.string(), Value: z.union([z.string(), z.number()]).optional() })) })
        .optional(),
    }),
  }),
});

export type CallbackOutcome = "ignored" | "duplicate" | "succeeded" | "failed" | "unverified" | "amount_mismatch";

/**
 * Handles Safaricom's STK callback. The caller has already checked the secret
 * token (and IP allowlist when configured). Never trusts the callback alone:
 * the amount must match, and by default the result is confirmed with an STK
 * Query before anything is activated.
 */
export async function handleStkCallback(raw: unknown): Promise<CallbackOutcome> {
  const parsed = callbackSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, "Malformed M-Pesa callback");
    return "ignored";
  }
  const cb = parsed.data.Body.stkCallback;
  const payment = await Payment.findOneAndUpdate(
    { checkoutRequestId: cb.CheckoutRequestID, merchantRequestId: cb.MerchantRequestID },
    { $push: { callbacks: { receivedAt: new Date(), body: raw } }, $inc: { callbackCount: 1 }, $set: { resultDesc: cb.ResultDesc } },
    { returnDocument: "after" },
  );
  if (!payment) {
    logger.warn({ checkoutRequestId: cb.CheckoutRequestID }, "Callback for unknown payment");
    return "ignored";
  }
  if (!["INITIATED", "PENDING"].includes(payment.status)) return "duplicate";

  if (cb.ResultCode !== "0") {
    // 1032 = cancelled by user, 1037 = phone unreachable, 2001 = wrong PIN, 1 = insufficient funds.
    await finalizeFailure(payment, cb.ResultCode === "1032" ? "CANCELLED" : "FAILED", cb.ResultDesc || "Payment was not completed", cb.ResultCode);
    return "failed";
  }

  const items = new Map((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]));
  const amount = Number(items.get("Amount"));
  const receipt = items.get("MpesaReceiptNumber") ? String(items.get("MpesaReceiptNumber")) : undefined;
  if (!Number.isFinite(amount) || Math.round(amount) !== payment.amountKes) {
    await audit({ action: "payment.amount_mismatch", entityType: "Payment", entityId: String(payment._id), metadata: { expected: payment.amountKes, received: amount } });
    await finalizeFailure(payment, "FAILED", "Amount paid does not match the amount due. Contact support.", cb.ResultCode);
    return "amount_mismatch";
  }

  if (env.MPESA_VERIFY_WITH_QUERY) {
    const status = await services().mpesa.queryStkStatus(cb.CheckoutRequestID).catch(() => undefined);
    if (status?.resultCode !== "0") {
      // Leave it PENDING; reconciliation will settle it once Daraja confirms either way.
      logger.warn({ paymentId: String(payment._id), status }, "Success callback not confirmed by STK query");
      return "unverified";
    }
  }

  await finalizeSuccess(payment._id, receipt, "callback");
  return "succeeded";
}

/** Asks Daraja for the outcome of a pending payment. Used by the job runner, polling clients and admins. */
export async function reconcilePayment(paymentId: string, actorId?: string): Promise<PaymentDoc> {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw AppError.notFound("Payment");
  if (!["INITIATED", "PENDING"].includes(payment.status) || !payment.checkoutRequestId) return payment;

  payment.lastQueriedAt = new Date();
  await payment.save();
  const status = await services().mpesa.queryStkStatus(payment.checkoutRequestId);

  if (status.resultCode === "0") await finalizeSuccess(payment._id, undefined, actorId ? "admin" : "query");
  else if (status.resultCode === "1032") await finalizeFailure(payment, "CANCELLED", status.resultDesc || "Cancelled", status.resultCode);
  else if (status.resultCode !== undefined) await finalizeFailure(payment, "FAILED", status.resultDesc || "Payment was not completed", status.resultCode);
  else if (Date.now() - payment.createdAt.getTime() > 24 * 3600_000) await finalizeFailure(payment, "FAILED", "No response from M-Pesa");

  if (actorId) await audit({ action: "payment.reconciled", actorId, actorRole: "ADMIN", entityType: "Payment", entityId: paymentId, metadata: { resultCode: status.resultCode } });
  return (await Payment.findById(paymentId))!;
}

export async function reconcileStalePayments(olderThanMs = 2 * 60_000): Promise<number> {
  const stale = await Payment.find({
    status: "PENDING",
    createdAt: { $lte: new Date(Date.now() - olderThanMs) },
    $or: [{ lastQueriedAt: null }, { lastQueriedAt: { $lte: new Date(Date.now() - 5 * 60_000) } }],
  })
    .select("_id")
    .limit(50)
    .lean();
  for (const p of stale) await reconcilePayment(String(p._id)).catch((err) => logger.warn({ err, paymentId: String(p._id) }, "Reconcile failed"));
  return stale.length;
}
