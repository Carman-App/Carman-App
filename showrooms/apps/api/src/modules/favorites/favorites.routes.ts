import { Router } from "express";
import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, requireAuth } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { handler, ok } from "../../utils/handler";
import { paginate } from "../../utils/slug";
import { Vehicle } from "../vehicles/vehicle.model";
import { loadSellers, serializeVehicle } from "../vehicles/vehicle.serializer";
import { POPULARITY } from "../vehicles/vehicles.service";
import { Favorite } from "./favorite.model";

const params = z.object({ vehicleId: objectIdSchema });

export function favoritesRoutes(): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    "/",
    handler({ query: paginationQuerySchema }, async ({ req, res, query }) => {
      const userId = requireAuth(req).userId;
      const [favs, total] = await Promise.all([
        Favorite.find({ userId }).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
        Favorite.countDocuments({ userId }),
      ]);
      const vehicles = await Vehicle.find({ _id: { $in: favs.map((f) => f.vehicleId) } }).lean();
      const byId = new Map(vehicles.map((v) => [String(v._id), v]));
      const sellerOf = await loadSellers(vehicles);
      // Keep saved order; sold/removed cars still show (as sold/unavailable) so buyers aren't confused.
      const items = favs
        .map((f) => byId.get(String(f.vehicleId)))
        .filter((v): v is NonNullable<typeof v> => !!v && ["ACTIVE", "SOLD"].includes(v.status))
        .map((v) => serializeVehicle(v, { seller: sellerOf(v), isFavorite: true }));
      ok(res, items, paginate(query.page, query.limit, total));
    }),
  );

  router.get(
    "/ids",
    handler({}, async ({ req, res }) => {
      const favs = await Favorite.find({ userId: requireAuth(req).userId }).select("vehicleId").limit(1000).lean();
      ok(res, favs.map((f) => String(f.vehicleId)));
    }),
  );

  router.post(
    "/:vehicleId",
    handler({ params }, async ({ req, res, params }) => {
      const userId = requireAuth(req).userId;
      const vehicle = await Vehicle.findById(params.vehicleId).select("status");
      if (!vehicle || vehicle.status !== "ACTIVE") throw AppError.notFound("Vehicle");
      const result = await Favorite.updateOne({ userId, vehicleId: params.vehicleId }, { $setOnInsert: { userId, vehicleId: params.vehicleId } }, { upsert: true });
      if (result.upsertedCount) await Vehicle.updateOne({ _id: params.vehicleId }, { $inc: { favoriteCount: 1, popularity: POPULARITY.favorite } });
      ok(res, { saved: true }, undefined, result.upsertedCount ? 201 : 200);
    }),
  );

  router.delete(
    "/:vehicleId",
    handler({ params }, async ({ req, res, params }) => {
      const result = await Favorite.deleteOne({ userId: requireAuth(req).userId, vehicleId: params.vehicleId });
      if (result.deletedCount) await Vehicle.updateOne({ _id: params.vehicleId }, { $inc: { favoriteCount: -1, popularity: -POPULARITY.favorite } });
      ok(res, { saved: false });
    }),
  );
  return router;
}

describeRoute({ method: "get", path: "/favorites", tag: "Favorites", summary: "Saved vehicles", auth: true, query: paginationQuerySchema });
describeRoute({ method: "get", path: "/favorites/ids", tag: "Favorites", summary: "Ids of saved vehicles (for heart icons)", auth: true });
describeRoute({ method: "post", path: "/favorites/:vehicleId", tag: "Favorites", summary: "Save a vehicle (idempotent)", auth: true });
describeRoute({ method: "delete", path: "/favorites/:vehicleId", tag: "Favorites", summary: "Unsave a vehicle", auth: true });
