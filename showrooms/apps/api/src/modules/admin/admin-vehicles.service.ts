import type { Types } from "mongoose";
import type { z } from "zod";
import type { adminVehiclesQuerySchema, featureVehicleSchema, moderateVehicleSchema, verifyVehicleSchema } from "@showrooms/shared";
import type { AuthContext } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { escapeRegex, paginate } from "../../utils/slug";
import { audit, type RequestMeta } from "../audit/audit.service";
import { promotionRank } from "../boosts/promotion";
import { notify } from "../notifications/notifications.service";
import { VehicleReport } from "../reports/report.model";
import { Vehicle } from "../vehicles/vehicle.model";
import { loadSellers, serializeVehicle } from "../vehicles/vehicle.serializer";
import { onPublished, refreshListingCount } from "../vehicles/vehicles.service";

export async function listVehicles(query: z.output<typeof adminVehiclesQuerySchema>) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.flagged !== undefined) filter.flagged = query.flagged;
  if (query.sellerId) filter.sellerId = query.sellerId;
  if (query.q) filter.title = new RegExp(escapeRegex(query.q), "i");
  // Pending queue is first-in-first-out; everything else newest first.
  const sort: Record<string, 1 | -1> = query.status === "PENDING_REVIEW" ? { flagged: -1, updatedAt: 1 } : { updatedAt: -1 };
  const [items, total] = await Promise.all([Vehicle.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(), Vehicle.countDocuments(filter)]);
  const sellerOf = await loadSellers(items);
  return {
    items: items.map((v) => ({ ...serializeVehicle(v, { private: true, seller: sellerOf(v) }), flagged: v.flagged, flagReasons: v.flagReasons })),
    meta: paginate(query.page, query.limit, total),
  };
}

export async function vehicleDetail(id: string) {
  const v = await Vehicle.findById(id).lean();
  if (!v) throw AppError.notFound("Vehicle");
  const [sellerOf, reports, duplicates] = await Promise.all([
    loadSellers([v]),
    VehicleReport.find({ vehicleId: v._id }).sort({ createdAt: -1 }).limit(50),
    Vehicle.find({ _id: { $in: v.possibleDuplicateOf } }).select("title slug status sellerId price images").lean(),
  ]);
  return {
    ...serializeVehicle(v, { private: true, seller: sellerOf(v) }),
    flagged: v.flagged,
    flagReasons: v.flagReasons,
    reports: reports.map((r) => r.toJSON()),
    possibleDuplicates: duplicates.map((d) => ({ id: String(d._id), title: d.title, slug: d.slug, status: d.status, sellerId: String(d.sellerId), price: d.price, image: d.images[0]?.url })),
  };
}

const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  APPROVE: { from: ["PENDING_REVIEW"], to: "ACTIVE" },
  REJECT: { from: ["PENDING_REVIEW", "ACTIVE"], to: "REJECTED" },
  REQUEST_CHANGES: { from: ["PENDING_REVIEW", "ACTIVE"], to: "REJECTED" },
  SUSPEND: { from: ["ACTIVE", "PENDING_REVIEW", "SOLD"], to: "SUSPENDED" },
  REINSTATE: { from: ["SUSPENDED"], to: "ACTIVE" },
};

/** Every decision is stored on the listing (with reason) and in the audit log. */
export async function moderate(actor: AuthContext, id: string, input: z.output<typeof moderateVehicleSchema>, meta: RequestMeta) {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw AppError.notFound("Vehicle");
  const t = TRANSITIONS[input.action]!;
  if (!t.from.includes(vehicle.status)) throw AppError.conflict(`Can't ${input.action.toLowerCase().replace("_", " ")} a ${vehicle.status.toLowerCase()} listing`);

  const previous = vehicle.status;
  vehicle.status = t.to as typeof vehicle.status;
  vehicle.moderationHistory.push({ action: input.action, reason: input.reason, by: actor.userId as unknown as Types.ObjectId, at: new Date() });
  if (input.action === "APPROVE" || input.action === "REINSTATE") {
    vehicle.rejectionReason = undefined;
    vehicle.publishedAt ??= new Date();
    if (input.action === "APPROVE") vehicle.flagged = false;
  } else {
    vehicle.rejectionReason = input.reason;
    vehicle.promotionRank = 0;
    vehicle.isFeatured = false;
  }
  await vehicle.save();

  await audit({ action: `vehicle.${input.action.toLowerCase()}`, actorId: actor.userId, actorRole: actor.role, entityType: "Vehicle", entityId: id, metadata: { from: previous, to: vehicle.status, reason: input.reason } }, meta);

  if (input.action === "APPROVE") {
    await onPublished(vehicle);
  } else {
    await refreshListingCount(vehicle);
    const titles: Record<string, string> = {
      REJECT: "Listing not approved",
      REQUEST_CHANGES: "Changes needed on your listing",
      SUSPEND: "Listing suspended",
      REINSTATE: "Listing restored",
    };
    await notify(vehicle.sellerId, {
      type: `LISTING_${input.action}`,
      title: titles[input.action]!,
      body: `${vehicle.title}${input.reason ? `: ${input.reason}` : " is live again."}`,
      data: { vehicleId: id, screen: "my-vehicles" },
      email: input.action !== "REINSTATE",
    });
  }
  return vehicleDetail(id);
}

export async function feature(actor: AuthContext, id: string, input: z.output<typeof featureVehicleSchema>, meta: RequestMeta) {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw AppError.notFound("Vehicle");
  if (input.featured && vehicle.status !== "ACTIVE") throw AppError.conflict("Only active listings can be featured");
  vehicle.isFeatured = input.featured;
  vehicle.featuredUntil = input.featured ? new Date(Date.now() + input.days * 86_400_000) : undefined;
  vehicle.promotionRank = promotionRank(vehicle);
  vehicle.moderationHistory.push({ action: input.featured ? "FEATURED" : "UNFEATURED", by: actor.userId as unknown as Types.ObjectId, at: new Date() });
  await vehicle.save();
  await audit({ action: input.featured ? "vehicle.featured" : "vehicle.unfeatured", actorId: actor.userId, actorRole: actor.role, entityType: "Vehicle", entityId: id, metadata: { days: input.days } }, meta);
  return vehicleDetail(id);
}

export async function setVehicleVerified(actor: AuthContext, id: string, input: z.output<typeof verifyVehicleSchema>, meta: RequestMeta) {
  const vehicle = await Vehicle.findById(id);
  if (!vehicle) throw AppError.notFound("Vehicle");
  vehicle.isVerified = input.verified;
  vehicle.moderationHistory.push({ action: input.verified ? "VERIFIED" : "UNVERIFIED", reason: input.note, by: actor.userId as unknown as Types.ObjectId, at: new Date() });
  await vehicle.save();
  await audit({ action: input.verified ? "vehicle.verified" : "vehicle.unverified", actorId: actor.userId, actorRole: actor.role, entityType: "Vehicle", entityId: id, metadata: { note: input.note } }, meta);
  return vehicleDetail(id);
}
