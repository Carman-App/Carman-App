import type { ClientSession, Types } from "mongoose";
import { Vehicle } from "../vehicles/vehicle.model";

/** Featured outranks boosted outranks normal in the "recommended" sort. */
export function promotionRank(v: { isFeatured?: boolean | null; featuredUntil?: Date | null; boostedUntil?: Date | null }, now = new Date()): number {
  if (v.isFeatured && v.featuredUntil && v.featuredUntil > now) return 2;
  if (v.boostedUntil && v.boostedUntil > now) return 1;
  return 0;
}

const later = (a?: Date | null, b?: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Extends a vehicle's promotion window; stacking purchases extends from the current end. */
export async function applyPromotion(vehicleId: Types.ObjectId | string, type: "BOOST" | "FEATURED", days: number, session?: ClientSession) {
  const vehicle = await Vehicle.findById(vehicleId).session(session ?? null);
  if (!vehicle) return null;
  const now = new Date();
  const current = type === "FEATURED" ? vehicle.featuredUntil : vehicle.boostedUntil;
  const start = current && current > now ? current : now;
  const end = new Date(start.getTime() + days * 86_400_000);
  if (type === "FEATURED") {
    vehicle.isFeatured = true;
    vehicle.featuredUntil = end;
    vehicle.boostedUntil = later(vehicle.boostedUntil, end);
  } else {
    vehicle.boostedUntil = end;
  }
  vehicle.promotionRank = promotionRank(vehicle, now);
  await vehicle.save({ session });
  return { start, end };
}

/** Clears expired promotions so the indexed sort stays correct. Run by the job runner. */
export async function expirePromotions(now = new Date()): Promise<number> {
  const expired = await Vehicle.find({
    $or: [
      { isFeatured: true, featuredUntil: { $lte: now } },
      { promotionRank: { $gt: 0 }, boostedUntil: { $lte: now } },
      { promotionRank: 2, featuredUntil: { $lte: now } },
    ],
  }).select("isFeatured featuredUntil boostedUntil promotionRank");
  for (const v of expired) {
    if (v.featuredUntil && v.featuredUntil <= now) v.isFeatured = false;
    v.promotionRank = promotionRank(v, now);
    await v.save();
  }
  return expired.length;
}
