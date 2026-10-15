import { Router } from "express";
import { analyticsRangeSchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, authorize, requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import { getSellerContext } from "../sellers/seller-context";
import { sellerAnalytics } from "./analytics.service";

export function analyticsRoutes(): Router {
  const router = Router();
  router.get(
    "/seller",
    authenticate,
    authorize("BROKER", "DEALER"),
    handler({ query: analyticsRangeSchema }, async ({ req, res, query }) => {
      ok(res, await sellerAnalytics(await getSellerContext(requireAuth(req)), query.days));
    }),
  );
  return router;
}

describeRoute({
  method: "get",
  path: "/analytics/seller",
  tag: "Analytics",
  summary: "Views, WhatsApp/Call clicks (intent, not confirmed conversations), viewing requests and per-listing performance. Daily series on paid plans.",
  auth: true,
  query: analyticsRangeSchema,
});
