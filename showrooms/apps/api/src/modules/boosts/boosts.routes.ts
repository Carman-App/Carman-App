import { Router } from "express";
import { z } from "zod";
import { createBoostSchema, objectIdSchema, paginationQuerySchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { publicCache } from "../../middleware/cache";
import { authenticate, authorize, requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import { idempotencyKeyOf } from "../payments/payments.routes";
import { getSellerContext } from "../sellers/seller-context";
import { getSettings } from "../settings/settings.service";
import * as boosts from "./boosts.service";

/** POST /vehicles/:vehicleId/boost */
export function vehicleBoostRoutes(): Router {
  const router = Router({ mergeParams: true });
  router.post(
    "/",
    authenticate,
    authorize("BROKER", "DEALER"),
    handler({ params: z.object({ vehicleId: objectIdSchema }), body: createBoostSchema }, async ({ req, res, params, body }) => {
      const result = await boosts.createBoost(await getSellerContext(requireAuth(req)), params.vehicleId, body, idempotencyKeyOf(req));
      ok(res, result, undefined, 201);
    }),
  );
  return router;
}

export function boostsRoutes(): Router {
  const router = Router();
  router.get(
    "/packages",
    handler({}, async ({ res }) => {
      publicCache(res, false, 300);
      ok(res, (await getSettings()).boostPackages);
    }),
  );
  router.get(
    "/me",
    authenticate,
    authorize("BROKER", "DEALER"),
    handler({ query: paginationQuerySchema }, async ({ req, res, query }) => {
      const { items, meta } = await boosts.myBoosts(await getSellerContext(requireAuth(req)), query.page, query.limit);
      ok(res, items, meta);
    }),
  );
  return router;
}

describeRoute({ method: "post", path: "/vehicles/:vehicleId/boost", tag: "Boosts", summary: "Buy a boost or featured slot (M-Pesa); activates only after verified payment", auth: true, body: createBoostSchema });
describeRoute({ method: "get", path: "/boosts/packages", tag: "Boosts", summary: "Promotion packages and prices" });
describeRoute({ method: "get", path: "/boosts/me", tag: "Boosts", summary: "My promotions", auth: true, query: paginationQuerySchema });
