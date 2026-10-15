import { createHash } from "node:crypto";
import mongoose, { type Types } from "mongoose";
import type { z } from "zod";
import {
  countyOf,
  publishableVehicleSchema,
  slugify,
  vehicleTitle,
  type markSoldSchema,
  type myVehiclesQuerySchema,
  type updateVehicleSchema,
  type vehicleDraftSchema,
  type VehicleSearchParams,
  type Vehicle as VehicleDto,
} from "@showrooms/shared";
import type { AuthContext } from "../../middleware/auth";
import { services } from "../../services";
import { AppError } from "../../utils/app-error";
import { escapeRegex, paginate, shortId } from "../../utils/slug";
import { BrokerProfile } from "../brokers/broker-profile.model";
import { Category } from "../categories/category.model";
import { DealerProfile } from "../dealers/dealer-profile.model";
import { Favorite, BrokerFollow } from "../favorites/favorite.model";
import { notify } from "../notifications/notifications.service";
import { canManageVehicle, inventoryFilter, type SellerContext } from "../sellers/seller-context";
import { getSettings } from "../settings/settings.service";
import { getEntitlements, LIMITED_STATUSES } from "../subscriptions/entitlements.service";
import { ContactClick, VehicleView } from "./vehicle-events.model";
import { Vehicle, type VehicleDoc } from "./vehicle.model";
import { loadSellers, serializeVehicle } from "./vehicle.serializer";

type DraftInput = z.output<typeof vehicleDraftSchema>;
type UpdateInput = z.output<typeof updateVehicleSchema>;

const EDITABLE = ["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE"] as const;
const MATERIAL_FIELDS = ["make", "model", "year"] as const;

/** Popularity weights: a contact or save says more than a view. */
export const POPULARITY = { view: 1, contact: 5, favorite: 3, inquiry: 8 } as const;

/** Calendar day in Nairobi time, for de-duplicating views per day. */
export function eatDay(date = new Date()): string {
  return new Date(date.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

async function canonicalMake(make: string): Promise<string> {
  const match = await Category.findOne({ kind: "MAKE", slug: slugify(make) }).select("name").lean();
  return match?.name ?? make;
}

async function applyFields(vehicle: VehicleDoc, input: DraftInput): Promise<void> {
  const { location, make, ...rest } = input;
  Object.assign(vehicle, rest);
  if (make !== undefined) {
    vehicle.make = await canonicalMake(make);
    vehicle.makeKey = slugify(vehicle.make);
  }
  if (input.model !== undefined) vehicle.modelKey = slugify(input.model);
  if (location) vehicle.location = { town: location.town, area: location.area, county: countyOf(location.town) };
  vehicle.title = vehicleTitle({ year: vehicle.year ?? undefined, make: vehicle.make ?? undefined, model: vehicle.model ?? undefined });
  vehicle.slug = `${slugify(vehicle.title)}-${vehicle.shortId}`;
}

export function fingerprint(v: { makeKey?: string | null; modelKey?: string | null; year?: number | null; mileage?: number | null; color?: string | null }): string {
  const key = [v.makeKey, v.modelKey, v.year, Math.round((v.mileage ?? 0) / 1000), (v.color ?? "").toLowerCase().trim()].join("|");
  return createHash("sha1").update(key).digest("hex");
}

/** Keeps the public "N active listings" counter on the broker/dealer profile accurate. */
export async function refreshListingCount(vehicle: { sellerId: Types.ObjectId | string; dealerId?: Types.ObjectId | string | null }): Promise<void> {
  if (vehicle.dealerId) {
    const count = await Vehicle.countDocuments({ dealerId: vehicle.dealerId, status: "ACTIVE" });
    await DealerProfile.updateOne({ _id: vehicle.dealerId }, { activeListingCount: count });
  } else {
    const count = await Vehicle.countDocuments({ sellerId: vehicle.sellerId, dealerId: null, status: "ACTIVE" });
    await BrokerProfile.updateOne({ userId: vehicle.sellerId }, { activeListingCount: count });
  }
}

async function loadManaged(ctx: SellerContext, id: string): Promise<VehicleDoc> {
  if (!mongoose.isValidObjectId(id)) throw AppError.notFound("Vehicle");
  const vehicle = await Vehicle.findById(id);
  // Same 404 whether it doesn't exist or belongs to someone else: no probing other sellers' ids.
  if (!vehicle || !canManageVehicle(ctx, vehicle)) throw AppError.notFound("Vehicle");
  return vehicle;
}

export async function getManagedVehicle(ctx: SellerContext, id: string): Promise<VehicleDoc> {
  return loadManaged(ctx, id);
}

export async function createDraft(ctx: SellerContext, input: DraftInput): Promise<VehicleDto> {
  const vehicle = new Vehicle({
    sellerId: ctx.userId,
    dealerId: ctx.kind === "DEALER" ? ctx.dealer!._id : undefined,
    shortId: shortId(),
    status: "DRAFT",
    title: "Untitled vehicle",
    slug: "pending",
  });
  await applyFields(vehicle, input);
  await vehicle.save();
  return serializeVehicle(vehicle.toObject(), { private: true });
}

export async function updateVehicle(ctx: SellerContext, id: string, input: UpdateInput): Promise<VehicleDto> {
  const vehicle = await loadManaged(ctx, id);
  if (!(EDITABLE as readonly string[]).includes(vehicle.status)) {
    throw AppError.conflict(`A ${vehicle.status.toLowerCase().replace("_", " ")} listing can't be edited`);
  }

  const { imageOrder, videoOrder, ...fields } = input;
  const before = { make: vehicle.make, model: vehicle.model, year: vehicle.year };
  await applyFields(vehicle, fields);

  const removed: { publicId: string; type: "image" | "video" }[] = [];
  if (imageOrder) {
    const byId = new Map(vehicle.images.map((i) => [i.publicId, i]));
    if (!imageOrder.every((pid) => byId.has(pid))) throw AppError.badRequest("imageOrder contains images that are not on this listing");
    removed.push(...vehicle.images.filter((i) => !imageOrder.includes(i.publicId)).map((i) => ({ publicId: i.publicId, type: "image" as const })));
    vehicle.set("images", imageOrder.map((pid) => byId.get(pid)!.toObject()));
  }
  if (videoOrder) {
    const byId = new Map(vehicle.videos.map((v) => [v.publicId, v]));
    if (!videoOrder.every((pid) => byId.has(pid))) throw AppError.badRequest("videoOrder contains videos that are not on this listing");
    removed.push(...vehicle.videos.filter((v) => !videoOrder.includes(v.publicId)).map((v) => ({ publicId: v.publicId, type: "video" as const })));
    vehicle.set("videos", videoOrder.map((pid) => byId.get(pid)!.toObject()));
  }

  // Changing what the car *is* on a live listing sends it back for review.
  const settings = await getSettings();
  const materialChange = MATERIAL_FIELDS.some((f) => before[f] !== vehicle[f]);
  if (vehicle.status === "ACTIVE" && materialChange && settings.requireListingApproval) {
    vehicle.status = "PENDING_REVIEW";
    vehicle.moderationHistory.push({ action: "SUBMITTED", reason: "Make, model or year changed", by: ctx.userId as unknown as Types.ObjectId, at: new Date() });
  }

  await vehicle.save();
  for (const r of removed) services().media.deleteAsset(r.publicId, r.type, "upload").catch(() => undefined);
  if (vehicle.status !== "ACTIVE") await refreshListingCount(vehicle);
  return serializeVehicle(vehicle.toObject(), { private: true });
}

export async function submitVehicle(ctx: SellerContext, id: string): Promise<VehicleDto> {
  const vehicle = await loadManaged(ctx, id);
  if (vehicle.status !== "DRAFT" && vehicle.status !== "REJECTED") {
    throw AppError.conflict("Only drafts and listings that need changes can be submitted");
  }

  const check = publishableVehicleSchema.safeParse(vehicle.toObject());
  if (!check.success) {
    throw new AppError(422, "VALIDATION_ERROR", "Complete the listing before submitting", check.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  if (vehicle.images.length < 1) {
    throw new AppError(422, "VALIDATION_ERROR", "Add at least one photo", [{ path: "images", message: "Add at least one photo" }]);
  }

  const ent = await getEntitlements(ctx);
  if (ent.activeListings >= ent.listingLimit) {
    throw new AppError(403, "FORBIDDEN", `Your ${ent.planName} plan allows ${ent.listingLimit} active listings. Mark a vehicle as sold, archive one, or upgrade your plan.`, {
      reason: "PLAN_LIMIT",
      limit: ent.listingLimit,
    });
  }

  // Duplicate detection: same make/model/year/mileage/colour already live anywhere on the platform.
  vehicle.duplicateFingerprint = fingerprint(vehicle);
  const duplicates = await Vehicle.find({
    _id: { $ne: vehicle._id },
    duplicateFingerprint: vehicle.duplicateFingerprint,
    status: { $in: ["ACTIVE", "PENDING_REVIEW", "SUSPENDED"] },
  })
    .select("_id")
    .limit(5)
    .lean();
  vehicle.set("possibleDuplicateOf", duplicates.map((d) => d._id));
  if (duplicates.length && !vehicle.flagReasons.includes("POSSIBLE_DUPLICATE")) {
    vehicle.flagged = true;
    vehicle.flagReasons.push("POSSIBLE_DUPLICATE");
  }

  const settings = await getSettings();
  const profile = ctx.kind === "DEALER" ? ctx.dealer! : ctx.broker!;
  const trusted = settings.autoApproveVerifiedSellers && profile.verificationStatus === "VERIFIED" && duplicates.length === 0;
  vehicle.rejectionReason = undefined;

  if (!settings.requireListingApproval || trusted) {
    vehicle.status = "ACTIVE";
    vehicle.publishedAt ??= new Date();
    vehicle.moderationHistory.push({ action: "AUTO_APPROVED", by: ctx.userId as unknown as Types.ObjectId, at: new Date() });
    await vehicle.save();
    await onPublished(vehicle);
  } else {
    vehicle.status = "PENDING_REVIEW";
    vehicle.moderationHistory.push({ action: "SUBMITTED", by: ctx.userId as unknown as Types.ObjectId, at: new Date() });
    await vehicle.save();
  }
  return serializeVehicle(vehicle.toObject(), { private: true });
}

/** Runs whenever a listing goes live (auto-approved or approved by an admin). */
export async function onPublished(vehicle: VehicleDoc): Promise<void> {
  await refreshListingCount(vehicle);
  const data = { vehicleId: String(vehicle._id), slug: vehicle.slug, screen: "vehicle" };
  await notify(vehicle.sellerId, {
    type: "LISTING_APPROVED",
    title: "Your vehicle is listed!",
    body: `${vehicle.title} is now live. Share it on WhatsApp to reach more buyers.`,
    data,
  });

  const target: { targetType: "BROKER" | "DEALER"; targetId?: Types.ObjectId | null } = vehicle.dealerId
    ? { targetType: "DEALER", targetId: vehicle.dealerId }
    : { targetType: "BROKER", targetId: (await BrokerProfile.findOne({ userId: vehicle.sellerId }).select("_id").lean())?._id };
  if (target.targetId) {
    const followers = await BrokerFollow.find(target).select("userId").limit(1000).lean();
    if (followers.length) {
      await notify(
        followers.map((f) => f.userId),
        { type: "FOLLOWED_SELLER_LISTING", title: "New listing from a showroom you follow", body: `${vehicle.title} — just listed.`, data },
      );
    }
  }
}

export async function markSold(ctx: SellerContext, id: string, input: z.output<typeof markSoldSchema>): Promise<VehicleDto> {
  const vehicle = await loadManaged(ctx, id);
  if (vehicle.status !== "ACTIVE") throw AppError.conflict("Only active listings can be marked as sold");
  vehicle.status = "SOLD";
  vehicle.soldAt = new Date();
  vehicle.soldPrice = input.soldPrice;
  vehicle.promotionRank = 0;
  vehicle.isFeatured = false;
  await vehicle.save();
  await refreshListingCount(vehicle);
  return serializeVehicle(vehicle.toObject(), { private: true });
}

/** Drafts are deleted (with their media); anything that was ever submitted is archived for the record. */
export async function removeVehicle(ctx: SellerContext, id: string): Promise<{ deleted: boolean }> {
  const vehicle = await loadManaged(ctx, id);
  if (vehicle.status === "DRAFT") {
    await vehicle.deleteOne();
    for (const img of vehicle.images) services().media.deleteAsset(img.publicId, "image", "upload").catch(() => undefined);
    for (const vid of vehicle.videos) services().media.deleteAsset(vid.publicId, "video", "upload").catch(() => undefined);
    return { deleted: true };
  }
  if (vehicle.status === "SUSPENDED") throw AppError.conflict("Suspended listings stay on record; contact support");
  vehicle.status = "ARCHIVED";
  vehicle.archivedAt = new Date();
  vehicle.promotionRank = 0;
  vehicle.isFeatured = false;
  await vehicle.save();
  await refreshListingCount(vehicle);
  return { deleted: false };
}

export async function listMine(ctx: SellerContext, query: z.output<typeof myVehiclesQuerySchema>) {
  const filter: Record<string, unknown> = { ...inventoryFilter(ctx) };
  if (query.status) filter.status = query.status;
  else filter.status = { $ne: "ARCHIVED" };
  if (query.q) filter.title = new RegExp(escapeRegex(query.q), "i");
  const [items, total, counts] = await Promise.all([
    Vehicle.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Vehicle.countDocuments(filter),
    Vehicle.aggregate<{ _id: string; n: number }>([{ $match: inventoryFilter(ctx) }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  return {
    items: items.map((v) => serializeVehicle(v, { private: true })),
    meta: { ...paginate(query.page, query.limit, total), statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])) },
  };
}

const SORTS: Record<VehicleSearchParams["sort"], Record<string, 1 | -1>> = {
  recommended: { promotionRank: -1, publishedAt: -1, _id: -1 },
  newest: { publishedAt: -1, _id: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: -1 },
  popular: { popularity: -1, publishedAt: -1 },
  year_desc: { year: -1, publishedAt: -1 },
  mileage_asc: { mileage: 1, publishedAt: -1 },
};

export function buildSearchFilter(p: VehicleSearchParams): Record<string, unknown> {
  const filter: Record<string, unknown> = { status: "ACTIVE" };
  if (p.make) filter.makeKey = slugify(p.make);
  if (p.model) filter.modelKey = slugify(p.model);
  if (p.minPrice !== undefined || p.maxPrice !== undefined) filter.price = { ...(p.minPrice !== undefined && { $gte: p.minPrice }), ...(p.maxPrice !== undefined && { $lte: p.maxPrice }) };
  if (p.minYear !== undefined || p.maxYear !== undefined) filter.year = { ...(p.minYear !== undefined && { $gte: p.minYear }), ...(p.maxYear !== undefined && { $lte: p.maxYear }) };
  if (p.maxMileage !== undefined) filter.mileage = { $lte: p.maxMileage };
  if (p.town) filter["location.town"] = p.town;
  for (const key of ["fuelType", "transmission", "bodyType", "driveType", "condition", "importStatus"] as const) {
    if (p[key]) filter[key] = p[key];
  }
  if (p.dealerId) filter.dealerId = p.dealerId;
  else if (p.sellerId) {
    filter.sellerId = p.sellerId;
    filter.dealerId = null;
  }
  if (p.featured) {
    filter.isFeatured = true;
    filter.featuredUntil = { $gt: new Date() };
  }
  return filter;
}

async function favoriteSet(userId: string | undefined, ids: Types.ObjectId[]): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set();
  const favs = await Favorite.find({ userId, vehicleId: { $in: ids } }).select("vehicleId").lean();
  return new Set(favs.map((f) => String(f.vehicleId)));
}

export async function searchVehicles(p: VehicleSearchParams, auth?: AuthContext) {
  const filter = buildSearchFilter(p);
  const sort = SORTS[p.sort];
  const skip = (p.page - 1) * p.limit;

  let query = filter;
  if (p.q) query = { ...filter, $text: { $search: p.q } };
  let [items, total] = await Promise.all([Vehicle.find(query).sort(sort).skip(skip).limit(p.limit).lean(), Vehicle.countDocuments(query)]);

  // Text search needs whole words; fall back to a prefix match on the title for partial input like "fiel".
  if (p.q && total === 0) {
    query = { ...filter, title: new RegExp(escapeRegex(p.q), "i") };
    [items, total] = await Promise.all([Vehicle.find(query).sort(sort).skip(skip).limit(p.limit).lean(), Vehicle.countDocuments(query)]);
  }

  const [sellerOf, favs] = await Promise.all([loadSellers(items), favoriteSet(auth?.userId, items.map((i) => i._id))]);
  return {
    items: items.map((v) => serializeVehicle(v, { seller: sellerOf(v), isFavorite: auth ? favs.has(String(v._id)) : undefined })),
    meta: paginate(p.page, p.limit, total),
  };
}

export async function findByIdOrSlug(idOrSlug: string): Promise<VehicleDoc | null> {
  if (mongoose.isValidObjectId(idOrSlug) && /^[a-f\d]{24}$/i.test(idOrSlug)) return Vehicle.findById(idOrSlug);
  const bySlug = await Vehicle.findOne({ slug: idOrSlug });
  if (bySlug) return bySlug;
  // Title changed since the link was shared: the short id at the end still identifies it.
  const tail = /-([a-z0-9]{6})$/.exec(idOrSlug)?.[1];
  return tail ? Vehicle.findOne({ shortId: tail }) : null;
}

/** Can this viewer see the listing at all? Owners and admins see everything. */
async function isVisible(vehicle: VehicleDoc, auth?: AuthContext, ctx?: SellerContext | null): Promise<{ visible: boolean; owner: boolean }> {
  const owner = !!ctx && canManageVehicle(ctx, vehicle);
  if (owner || auth?.role === "ADMIN") return { visible: true, owner: owner || auth?.role === "ADMIN" };
  if (vehicle.status === "ACTIVE") return { visible: true, owner: false };
  if (vehicle.status === "SOLD" && vehicle.soldAt) {
    const { soldListingVisibleDays } = await getSettings();
    return { visible: Date.now() - vehicle.soldAt.getTime() < soldListingVisibleDays * 86_400_000, owner: false };
  }
  return { visible: false, owner: false };
}

export async function getVehicle(idOrSlug: string, auth?: AuthContext, ctx?: SellerContext | null): Promise<VehicleDto> {
  const vehicle = await findByIdOrSlug(idOrSlug);
  if (!vehicle) throw AppError.notFound("Vehicle");
  const { visible, owner } = await isVisible(vehicle, auth, ctx);
  if (!visible) throw AppError.notFound("Vehicle");
  const [sellerOf, favs] = await Promise.all([loadSellers([vehicle]), favoriteSet(auth?.userId, [vehicle._id])]);
  return serializeVehicle(vehicle.toObject(), { private: owner, seller: sellerOf(vehicle), isFavorite: auth ? favs.has(String(vehicle._id)) : undefined });
}

export async function similarVehicles(idOrSlug: string): Promise<VehicleDto[]> {
  const base = await findByIdOrSlug(idOrSlug);
  if (!base) throw AppError.notFound("Vehicle");
  const or: Record<string, unknown>[] = [];
  if (base.makeKey && base.modelKey) or.push({ makeKey: base.makeKey, modelKey: base.modelKey });
  if (base.bodyType && base.price) or.push({ bodyType: base.bodyType, price: { $gte: Math.round(base.price * 0.7), $lte: Math.round(base.price * 1.3) } });
  if (or.length === 0) return [];
  const items = await Vehicle.find({ status: "ACTIVE", _id: { $ne: base._id }, $or: or }).sort(SORTS.recommended).limit(8).lean();
  const sellerOf = await loadSellers(items);
  return items.map((v) => serializeVehicle(v, { seller: sellerOf(v) }));
}

export interface ViewerMeta {
  ip?: string;
  userAgent?: string;
  source?: "web" | "mobile" | "unknown";
}

function viewerKey(auth: AuthContext | undefined, meta: ViewerMeta): string {
  return auth ? `u:${auth.userId}` : `a:${createHash("sha256").update(`${meta.ip ?? ""}|${meta.userAgent ?? ""}`).digest("hex").slice(0, 32)}`;
}

async function liveVehicleForEvent(id: string): Promise<VehicleDoc> {
  if (!mongoose.isValidObjectId(id)) throw AppError.notFound("Vehicle");
  const vehicle = await Vehicle.findById(id).select("sellerId dealerId status");
  if (!vehicle || vehicle.status !== "ACTIVE") throw AppError.notFound("Vehicle");
  return vehicle;
}

/** Counts at most one view per viewer per vehicle per day; sellers viewing their own listing don't count. */
export async function recordView(id: string, auth: AuthContext | undefined, meta: ViewerMeta): Promise<{ counted: boolean }> {
  const vehicle = await liveVehicleForEvent(id);
  if (auth && String(vehicle.sellerId) === auth.userId) return { counted: false };
  try {
    await VehicleView.create({
      vehicleId: vehicle._id,
      sellerId: vehicle.sellerId,
      dealerId: vehicle.dealerId,
      viewerId: auth?.userId,
      viewerKey: viewerKey(auth, meta),
      day: eatDay(),
      source: meta.source ?? "unknown",
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { counted: false };
    throw err;
  }
  await Vehicle.updateOne({ _id: vehicle._id }, { $inc: { viewCount: 1, popularity: POPULARITY.view } });
  return { counted: true };
}

/** A tap on WhatsApp/Call. Intent only: not a confirmed conversation or sale. */
export async function recordContact(id: string, channel: "WHATSAPP" | "CALL", auth: AuthContext | undefined, meta: ViewerMeta): Promise<{ counted: boolean }> {
  const vehicle = await liveVehicleForEvent(id);
  if (auth && String(vehicle.sellerId) === auth.userId) return { counted: false };
  try {
    await ContactClick.create({
      vehicleId: vehicle._id,
      sellerId: vehicle.sellerId,
      dealerId: vehicle.dealerId,
      viewerId: auth?.userId,
      viewerKey: viewerKey(auth, meta),
      channel,
      day: eatDay(),
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { counted: false };
    throw err;
  }
  await Vehicle.updateOne(
    { _id: vehicle._id },
    { $inc: { [channel === "WHATSAPP" ? "whatsappClicks" : "callClicks"]: 1, popularity: POPULARITY.contact } },
  );
  return { counted: true };
}

export async function countsBySellerScope(ctx: SellerContext) {
  return Vehicle.countDocuments({ ...inventoryFilter(ctx), status: { $in: LIMITED_STATUSES } });
}
