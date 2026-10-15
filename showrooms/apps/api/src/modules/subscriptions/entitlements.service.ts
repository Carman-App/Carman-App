import type { Entitlements, PlanFeatureKey } from "@showrooms/shared";
import { AppError } from "../../utils/app-error";
import { inventoryFilter, type SellerContext } from "../sellers/seller-context";
import { Vehicle } from "../vehicles/vehicle.model";
import { FALLBACK_FREE_PLAN } from "./plans";
import { Subscription, SubscriptionPlan } from "./subscription.model";

/** Listings that count towards the plan limit. */
export const LIMITED_STATUSES = ["ACTIVE", "PENDING_REVIEW"] as const;

/**
 * What the seller's current plan allows. Derived only from server-side
 * subscription records activated by verified payments.
 */
export async function getEntitlements(ctx: SellerContext): Promise<Entitlements> {
  const now = new Date();
  const sub = await Subscription.findOne({ userId: ctx.billingUserId, status: "ACTIVE", endsAt: { $gt: now } }).sort({ endsAt: -1 }).lean();
  const plan = sub ? await SubscriptionPlan.findById(sub.planId).lean() : await SubscriptionPlan.findOne({ code: "FREE" }).lean();
  const source = plan ?? FALLBACK_FREE_PLAN;

  const activeListings = await Vehicle.countDocuments({ ...inventoryFilter(ctx), status: { $in: LIMITED_STATUSES } });
  return {
    planCode: source.code,
    planName: source.name,
    listingLimit: source.listingLimit,
    staffLimit: source.staffLimit ?? 0,
    activeListings,
    features: source.features as Record<PlanFeatureKey, boolean>,
    subscriptionEndsAt: sub?.endsAt?.toISOString(),
  };
}

export async function requireFeature(ctx: SellerContext, feature: PlanFeatureKey, label: string): Promise<Entitlements> {
  const ent = await getEntitlements(ctx);
  if (!ent.features[feature]) throw AppError.forbidden(`${label} is available on a paid plan. Upgrade to unlock it.`);
  return ent;
}
