import type { SellerSummary, Vehicle as VehicleDto } from "@showrooms/shared";
import type { Types } from "mongoose";
import { BrokerProfile } from "../brokers/broker-profile.model";
import { DealerProfile } from "../dealers/dealer-profile.model";
import type { VehicleAttrs } from "./vehicle.model";

type VehicleLike = VehicleAttrs & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : undefined);

/**
 * The only way a vehicle leaves the API. Counters, moderation notes and
 * duplicate flags are included for the owner and admins only.
 */
export function serializeVehicle(v: VehicleLike, opts: { private?: boolean; seller?: SellerSummary; isFavorite?: boolean } = {}): VehicleDto {
  const now = Date.now();
  const dto: VehicleDto = {
    id: String(v._id),
    slug: v.slug,
    title: v.title,
    sellerId: String(v.sellerId),
    dealerId: v.dealerId ? String(v.dealerId) : undefined,
    make: v.make ?? "",
    model: v.model ?? "",
    year: v.year ?? 0,
    price: v.price ?? 0,
    priceNegotiable: !!v.priceNegotiable,
    mileage: v.mileage ?? 0,
    fuelType: v.fuelType as VehicleDto["fuelType"],
    transmission: v.transmission as VehicleDto["transmission"],
    engineCapacity: v.engineCapacity ?? 0,
    bodyType: v.bodyType as VehicleDto["bodyType"],
    driveType: v.driveType as VehicleDto["driveType"],
    color: v.color ?? "",
    condition: v.condition as VehicleDto["condition"],
    importStatus: v.importStatus as VehicleDto["importStatus"],
    location: { town: v.location?.town ?? "", county: v.location?.county ?? undefined, area: v.location?.area ?? undefined },
    description: v.description ?? "",
    features: v.features ?? [],
    images: (v.images ?? []).map((i) => ({ url: i.url, publicId: i.publicId, width: i.width ?? undefined, height: i.height ?? undefined })),
    videos: (v.videos ?? []).map((i) => ({ url: i.url, publicId: i.publicId, posterUrl: i.posterUrl ?? undefined, durationSec: i.durationSec ?? undefined })),
    status: v.status,
    isFeatured: !!v.isFeatured && !!v.featuredUntil && new Date(v.featuredUntil).getTime() > now,
    isBoosted: !!v.boostedUntil && new Date(v.boostedUntil).getTime() > now,
    isVerified: !!v.isVerified,
    publishedAt: iso(v.publishedAt),
    soldAt: iso(v.soldAt),
    createdAt: iso(v.createdAt)!,
    updatedAt: iso(v.updatedAt)!,
    seller: opts.seller,
    isFavorite: opts.isFavorite,
  };
  if (opts.private) {
    dto.stats = { views: v.viewCount, whatsappClicks: v.whatsappClicks, callClicks: v.callClicks, inquiries: v.inquiryCount, favorites: v.favoriteCount };
    dto.rejectionReason = v.rejectionReason ?? undefined;
    dto.moderationHistory = (v.moderationHistory ?? []).map((m) => ({ action: m.action, reason: m.reason ?? undefined, at: iso(m.at)! }));
  }
  return dto;
}

/** Batch-loads the public seller card for a page of vehicles (two queries, no N+1). */
export async function loadSellers(vehicles: { sellerId: unknown; dealerId?: unknown }[]): Promise<(v: { sellerId: unknown; dealerId?: unknown }) => SellerSummary | undefined> {
  const dealerIds = [...new Set(vehicles.filter((v) => v.dealerId).map((v) => String(v.dealerId)))];
  const brokerUserIds = [...new Set(vehicles.filter((v) => !v.dealerId).map((v) => String(v.sellerId)))];
  const [dealers, brokers] = await Promise.all([
    dealerIds.length ? DealerProfile.find({ _id: { $in: dealerIds } }).lean() : [],
    brokerUserIds.length ? BrokerProfile.find({ userId: { $in: brokerUserIds } }).lean() : [],
  ]);
  const dealerMap = new Map(dealers.map((d) => [String(d._id), d]));
  const brokerMap = new Map(brokers.map((b) => [String(b.userId), b]));

  return (v) => {
    if (v.dealerId) {
      const d = dealerMap.get(String(v.dealerId));
      if (!d) return undefined;
      return {
        type: "DEALER",
        id: String(d._id),
        slug: d.slug,
        name: d.businessName,
        phone: d.phone ?? undefined,
        whatsappNumber: d.whatsappNumber ?? d.phone ?? undefined,
        town: d.town ?? undefined,
        logoUrl: d.logo?.url,
        isVerified: d.verificationStatus === "VERIFIED",
        ratingAvg: d.ratingAvg,
        ratingCount: d.ratingCount,
        memberSince: iso(d.createdAt)!,
      };
    }
    const b = brokerMap.get(String(v.sellerId));
    if (!b) return undefined;
    return {
      type: "BROKER",
      id: String(b._id),
      slug: b.slug,
      name: b.displayName,
      phone: b.phone ?? undefined,
      whatsappNumber: b.whatsappNumber ?? b.phone ?? undefined,
      town: b.town ?? undefined,
      logoUrl: b.logo?.url,
      isVerified: b.verificationStatus === "VERIFIED",
      ratingAvg: b.ratingAvg,
      ratingCount: b.ratingCount,
      memberSince: iso(b.createdAt)!,
    };
  };
}
