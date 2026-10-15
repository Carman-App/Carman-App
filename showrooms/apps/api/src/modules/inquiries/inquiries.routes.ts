import { Router } from "express";
import { z } from "zod";
import { createInquirySchema, inquiriesQuerySchema, objectIdSchema, updateInquirySchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, authorize, requireAuth } from "../../middleware/auth";
import { created, handler, ok } from "../../utils/handler";
import { getSellerContext } from "../sellers/seller-context";
import { requireFeature } from "../subscriptions/entitlements.service";
import * as inquiries from "./inquiries.service";

/** POST /vehicles/:vehicleId/inquiries */
export function vehicleInquiryRoutes(): Router {
  const router = Router({ mergeParams: true });
  router.post(
    "/",
    authenticate,
    handler({ params: z.object({ vehicleId: objectIdSchema }), body: createInquirySchema }, async ({ req, res, params, body }) => {
      created(res, await inquiries.createInquiry(requireAuth(req), params.vehicleId, body));
    }),
  );
  return router;
}

/** GET /inquiries/me */
export function buyerInquiryRoutes(): Router {
  const router = Router();
  router.get(
    "/me",
    authenticate,
    handler({ query: inquiriesQuerySchema }, async ({ req, res, query }) => {
      const { items, meta } = await inquiries.listBuyerInquiries(requireAuth(req), query);
      ok(res, items, meta);
    }),
  );
  return router;
}

/** /broker/inquiries — leads for brokers and dealers. */
export function sellerInquiryRoutes(): Router {
  const router = Router();
  router.use(authenticate, authorize("BROKER", "DEALER"));
  router.get(
    "/inquiries",
    handler({ query: inquiriesQuerySchema }, async ({ req, res, query }) => {
      const { items, meta } = await inquiries.listSellerInquiries(await getSellerContext(requireAuth(req)), query);
      ok(res, items, meta);
    }),
  );
  router.patch(
    "/inquiries/:id",
    handler({ params: z.object({ id: objectIdSchema }), body: updateInquirySchema }, async ({ req, res, params, body }) => {
      const ctx = await getSellerContext(requireAuth(req));
      await requireFeature(ctx, "leadTracking", "Lead tracking");
      ok(res, await inquiries.updateSellerInquiry(ctx, params.id, body));
    }),
  );
  return router;
}

const tag = "Inquiries";
describeRoute({ method: "post", path: "/vehicles/:vehicleId/inquiries", tag, summary: "Request a viewing or ask a question", auth: true, body: createInquirySchema, responses: { 201: "Sent", 409: "Already open" } });
describeRoute({ method: "get", path: "/inquiries/me", tag, summary: "The buyer's inquiries", auth: true, query: inquiriesQuerySchema });
describeRoute({ method: "get", path: "/broker/inquiries", tag, summary: "Leads for the seller's vehicles", auth: true, query: inquiriesQuerySchema });
describeRoute({ method: "patch", path: "/broker/inquiries/:id", tag, summary: "Update lead status (paid plans)", auth: true, body: updateInquirySchema });
