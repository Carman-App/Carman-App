import { Router, type Request } from "express";
import { z } from "zod";
import {
  contactClickSchema,
  markSoldSchema,
  myVehiclesQuerySchema,
  objectIdSchema,
  updateVehicleSchema,
  vehicleDraftSchema,
  vehicleSearchSchema,
} from "@showrooms/shared";
import { env } from "../../config/env";
import { describeRoute } from "../../docs/openapi";
import { publicCache } from "../../middleware/cache";
import { authenticate, authorize, optionalAuth, requireAuth } from "../../middleware/auth";
import { hmac } from "../../utils/crypto";
import { created, handler, ok } from "../../utils/handler";
import { AppError } from "../../utils/app-error";
import { getSellerContext } from "../sellers/seller-context";
import { requireFeature } from "../subscriptions/entitlements.service";
import * as vehicles from "./vehicles.service";

const idParams = z.object({ id: objectIdSchema });
const idOrSlugParams = z.object({ id: z.string().min(1).max(120) });
const seller = [authenticate, authorize("BROKER", "DEALER")];

const viewerMeta = (req: Request) => ({
  ip: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
  source: (req.get("x-client-type") === "mobile" ? "mobile" : "web") as "web" | "mobile",
});

/** Signs a short-lived link to the web app's poster renderer (/api/posters/:id). */
export function signPosterUrl(vehicleId: string, ttlSec = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = hmac(env.POSTER_SIGNING_SECRET, `${vehicleId}.${exp}`);
  return `${env.WEB_URL}/api/posters/${vehicleId}?exp=${exp}&sig=${sig}`;
}

export function vehiclesRoutes(): Router {
  const router = Router();

  router.get(
    "/",
    optionalAuth,
    handler({ query: vehicleSearchSchema }, async ({ req, res, query }) => {
      const { items, meta } = await vehicles.searchVehicles(query, req.auth);
      publicCache(res, !!req.auth);
      ok(res, items, meta);
    }),
  );

  router.get(
    "/mine",
    ...seller,
    handler({ query: myVehiclesQuerySchema }, async ({ req, res, query }) => {
      const ctx = await getSellerContext(requireAuth(req));
      const { items, meta } = await vehicles.listMine(ctx, query);
      ok(res, items, meta);
    }),
  );

  router.post(
    "/",
    ...seller,
    handler({ body: vehicleDraftSchema }, async ({ req, res, body }) => {
      created(res, await vehicles.createDraft(await getSellerContext(requireAuth(req)), body));
    }),
  );

  router.get(
    "/:id",
    optionalAuth,
    handler({ params: idOrSlugParams }, async ({ req, res, params }) => {
      const ctx = req.auth && (req.auth.role === "BROKER" || req.auth.role === "DEALER") ? await getSellerContext(req.auth) : null;
      const vehicle = await vehicles.getVehicle(params.id, req.auth, ctx);
      publicCache(res, !!req.auth, 60);
      ok(res, vehicle);
    }),
  );

  router.get(
    "/:id/similar",
    handler({ params: idOrSlugParams }, async ({ res, params }) => {
      publicCache(res, false, 120);
      ok(res, await vehicles.similarVehicles(params.id));
    }),
  );

  router.patch(
    "/:id",
    ...seller,
    handler({ params: idParams, body: updateVehicleSchema }, async ({ req, res, params, body }) => {
      ok(res, await vehicles.updateVehicle(await getSellerContext(requireAuth(req)), params.id, body));
    }),
  );

  router.delete(
    "/:id",
    ...seller,
    handler({ params: idParams }, async ({ req, res, params }) => {
      ok(res, await vehicles.removeVehicle(await getSellerContext(requireAuth(req)), params.id));
    }),
  );

  router.post(
    "/:id/submit",
    ...seller,
    handler({ params: idParams }, async ({ req, res, params }) => {
      ok(res, await vehicles.submitVehicle(await getSellerContext(requireAuth(req)), params.id));
    }),
  );

  router.post(
    "/:id/mark-sold",
    ...seller,
    handler({ params: idParams, body: markSoldSchema }, async ({ req, res, params, body }) => {
      ok(res, await vehicles.markSold(await getSellerContext(requireAuth(req)), params.id, body));
    }),
  );

  router.post(
    "/:id/view",
    optionalAuth,
    handler({ params: idParams }, async ({ req, res, params }) => {
      ok(res, await vehicles.recordView(params.id, req.auth, viewerMeta(req)), undefined, 202);
    }),
  );

  router.post(
    "/:id/contact",
    optionalAuth,
    handler({ params: idParams, body: contactClickSchema }, async ({ req, res, params, body }) => {
      ok(res, await vehicles.recordContact(params.id, body.channel, req.auth, viewerMeta(req)), undefined, 202);
    }),
  );

  router.get(
    "/:id/poster",
    ...seller,
    handler({ params: idParams }, async ({ req, res, params }) => {
      const ctx = await getSellerContext(requireAuth(req));
      await requireFeature(ctx, "statusPosters", "WhatsApp Status posters");
      const vehicle = await vehicles.getManagedVehicle(ctx, params.id);
      if (vehicle.status !== "ACTIVE") throw AppError.conflict("Posters are available once the listing is live");
      ok(res, { url: signPosterUrl(params.id), width: 1080, height: 1920 });
    }),
  );

  return router;
}

const tag = "Vehicles";
describeRoute({ method: "get", path: "/vehicles", tag, summary: "Search active listings (filters, sort, pagination)", query: vehicleSearchSchema });
describeRoute({ method: "get", path: "/vehicles/mine", tag, summary: "The seller's own listings in every status", auth: true, query: myVehiclesQuerySchema });
describeRoute({ method: "post", path: "/vehicles", tag, summary: "Create a draft listing", auth: true, body: vehicleDraftSchema, responses: { 201: "Draft created", 403: "Not a seller" } });
describeRoute({ method: "get", path: "/vehicles/:id", tag, summary: "Listing by id or slug (owners/admins also see non-public statuses)" });
describeRoute({ method: "get", path: "/vehicles/:id/similar", tag, summary: "Similar active listings" });
describeRoute({ method: "patch", path: "/vehicles/:id", tag, summary: "Edit a listing; imageOrder sets order (first = primary) and removes omitted images", auth: true, body: updateVehicleSchema });
describeRoute({ method: "delete", path: "/vehicles/:id", tag, summary: "Delete a draft, or archive a submitted listing", auth: true });
describeRoute({ method: "post", path: "/vehicles/:id/submit", tag, summary: "Submit for review (or publish directly when approval is not required)", auth: true, responses: { 200: "Submitted", 403: "Plan limit reached", 422: "Listing incomplete" } });
describeRoute({ method: "post", path: "/vehicles/:id/mark-sold", tag, summary: "Mark an active listing as sold", auth: true, body: markSoldSchema });
describeRoute({ method: "post", path: "/vehicles/:id/view", tag, summary: "Record a view (one per viewer per day)", responses: { 202: "Recorded" } });
describeRoute({ method: "post", path: "/vehicles/:id/contact", tag, summary: "Record a WhatsApp/Call button tap (intent, not a confirmed conversation)", body: contactClickSchema, responses: { 202: "Recorded" } });
describeRoute({ method: "get", path: "/vehicles/:id/poster", tag, summary: "Signed link to a 1080×1920 WhatsApp Status poster (paid plans)", auth: true });
