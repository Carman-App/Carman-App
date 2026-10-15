import { Router } from "express";
import { DEFAULT_MAKES, BODY_TYPES, LABELS, slugify } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { publicCache } from "../../middleware/cache";
import { handler, ok } from "../../utils/handler";
import { Vehicle } from "../vehicles/vehicle.model";
import { Category } from "./category.model";

let countsCache: { at: number; makes: Map<string, number>; bodies: Map<string, number> } | undefined;

async function activeCounts() {
  if (countsCache && Date.now() - countsCache.at < 5 * 60_000) return countsCache;
  const [makes, bodies] = await Promise.all([
    Vehicle.aggregate<{ _id: string; n: number }>([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$makeKey", n: { $sum: 1 } } }]),
    Vehicle.aggregate<{ _id: string; n: number }>([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$bodyType", n: { $sum: 1 } } }]),
  ]);
  countsCache = { at: Date.now(), makes: new Map(makes.map((m) => [m._id, m.n])), bodies: new Map(bodies.map((b) => [b._id, b.n])) };
  return countsCache;
}

export function clearCategoryCountsCache() {
  countsCache = undefined;
}

/** Seeds makes and body types once; admins manage them afterwards. */
export async function ensureDefaultCategories(): Promise<void> {
  const popular = new Set(["Toyota", "Nissan", "Mazda", "Subaru", "Honda", "Mercedes-Benz", "Volkswagen", "Mitsubishi"]);
  for (const [i, make] of DEFAULT_MAKES.entries()) {
    await Category.updateOne(
      { kind: "MAKE", slug: slugify(make.name) },
      { $setOnInsert: { kind: "MAKE", name: make.name, slug: slugify(make.name), models: make.models, isPopular: popular.has(make.name), sortOrder: i } },
      { upsert: true },
    );
  }
  for (const [i, body] of BODY_TYPES.entries()) {
    await Category.updateOne(
      { kind: "BODY_TYPE", slug: slugify(body) },
      { $setOnInsert: { kind: "BODY_TYPE", name: LABELS.bodyType[body], slug: slugify(body), bodyType: body, isPopular: i < 6, sortOrder: i } },
      { upsert: true },
    );
  }
}

export function categoriesRoutes(): Router {
  const router = Router();
  router.get(
    "/",
    handler({}, async ({ res }) => {
      const [cats, counts] = await Promise.all([Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }), activeCounts()]);
      const out = cats.map((c) => ({ ...c.toJSON(), vehicleCount: c.kind === "MAKE" ? (counts.makes.get(c.slug) ?? 0) : (counts.bodies.get(c.bodyType ?? "") ?? 0) }));
      publicCache(res, false, 300);
      ok(res, { makes: out.filter((c) => c.kind === "MAKE"), bodyTypes: out.filter((c) => c.kind === "BODY_TYPE") });
    }),
  );
  return router;
}

describeRoute({ method: "get", path: "/categories", tag: "Categories", summary: "Active makes (with models) and body types, with live listing counts" });
