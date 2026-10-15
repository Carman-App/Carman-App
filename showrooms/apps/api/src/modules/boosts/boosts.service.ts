import type { z } from "zod";
import type { createBoostSchema } from "@showrooms/shared";
import { AppError } from "../../utils/app-error";
import { paginate } from "../../utils/slug";
import { initiatePayment } from "../payments/payments.service";
import type { SellerContext } from "../sellers/seller-context";
import { getSettings } from "../settings/settings.service";
import { Vehicle } from "../vehicles/vehicle.model";
import { getManagedVehicle } from "../vehicles/vehicles.service";
import { VehicleBoost } from "./boost.model";
import { promotionRank } from "./promotion";

export async function createBoost(ctx: SellerContext, vehicleId: string, input: z.output<typeof createBoostSchema>, idempotencyKey?: string) {
  const vehicle = await getManagedVehicle(ctx, vehicleId);
  if (vehicle.status !== "ACTIVE") throw AppError.conflict("Only live listings can be promoted");
  const pkg = (await getSettings()).boostPackages.find((p) => p.code === input.packageCode);
  if (!pkg) throw AppError.notFound("Promotion package");

  const boost = await VehicleBoost.create({ vehicleId: vehicle._id, userId: ctx.userId, type: pkg.type, packageCode: pkg.code, days: pkg.days, priceKes: pkg.priceKes });
  const payment = await initiatePayment({
    userId: ctx.userId,
    purpose: "BOOST",
    referenceId: boost._id,
    amountKes: pkg.priceKes,
    phone: input.phone,
    description: `${pkg.name}: ${vehicle.title}`.slice(0, 120),
    accountReference: `SR-${vehicle.shortId}`,
    idempotencyKey,
  });
  if (String(payment.referenceId) !== String(boost._id)) {
    await boost.deleteOne();
  } else {
    boost.paymentId = payment._id;
    await boost.save();
  }
  const current = await VehicleBoost.findById(payment.referenceId);
  return { boost: current?.toJSON(), payment: payment.toJSON() };
}

export async function myBoosts(ctx: SellerContext, page: number, limit: number) {
  const filter = { userId: ctx.userId };
  const [items, total] = await Promise.all([VehicleBoost.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), VehicleBoost.countDocuments(filter)]);
  const vehicles = await Vehicle.find({ _id: { $in: items.map((b) => b.vehicleId) } }).select("title slug").lean();
  const byId = new Map(vehicles.map((v) => [String(v._id), v]));
  return {
    items: items.map((b) => {
      const v = byId.get(String(b.vehicleId));
      return { ...b.toJSON(), vehicleId: String(b.vehicleId), vehicle: v && { id: String(v._id), title: v.title, slug: v.slug } };
    }),
    meta: paginate(page, limit, total),
  };
}

export async function expireBoosts(now = new Date()): Promise<number> {
  const expired = await VehicleBoost.find({ status: "ACTIVE", endsAt: { $lte: now } });
  for (const b of expired) {
    b.status = "EXPIRED";
    await b.save();
    const v = await Vehicle.findById(b.vehicleId);
    if (v) {
      if (v.featuredUntil && v.featuredUntil <= now) v.isFeatured = false;
      v.promotionRank = promotionRank(v, now);
      await v.save();
    }
  }
  return expired.length;
}
