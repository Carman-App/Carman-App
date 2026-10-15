import { Router } from "express";
import { z } from "zod";
import { subscribeSchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { publicCache } from "../../middleware/cache";
import { authenticate, authorize, requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import { idempotencyKeyOf } from "../payments/payments.routes";
import { getSellerContext } from "../sellers/seller-context";
import * as subscriptions from "./subscriptions.service";

export function subscriptionsRoutes(): Router {
  const router = Router();
  router.get(
    "/plans",
    handler({ query: z.object({ audience: z.enum(["BROKER", "DEALER"]).optional() }) }, async ({ res, query }) => {
      publicCache(res, false, 300);
      ok(res, await subscriptions.listPlans(query.audience));
    }),
  );
  router.use(authenticate, authorize("BROKER", "DEALER"));
  router.post(
    "/",
    handler({ body: subscribeSchema }, async ({ req, res, body }) => {
      const result = await subscriptions.subscribe(await getSellerContext(requireAuth(req)), body, idempotencyKeyOf(req));
      ok(res, result, undefined, 201);
    }),
  );
  router.get("/me", handler({}, async ({ req, res }) => ok(res, await subscriptions.mySubscription(await getSellerContext(requireAuth(req))))));
  return router;
}

describeRoute({ method: "get", path: "/subscriptions/plans", tag: "Subscriptions", summary: "Active plans with prices and limits (from the database)" });
describeRoute({ method: "post", path: "/subscriptions", tag: "Subscriptions", summary: "Subscribe: free plans activate now, paid plans send an M-Pesa prompt", auth: true, body: subscribeSchema });
describeRoute({ method: "get", path: "/subscriptions/me", tag: "Subscriptions", summary: "Current plan, entitlements, pending payment and history", auth: true });
