import type { PlanFeatureKey } from "@showrooms/shared";
import { SubscriptionPlan } from "./subscription.model";

type PlanSeed = {
  code: string;
  name: string;
  description: string;
  audience: "BROKER" | "DEALER" | "ALL";
  priceKes: number;
  periodDays: number;
  listingLimit: number;
  staffLimit: number;
  features: Record<PlanFeatureKey, boolean>;
  highlights: string[];
  sortOrder: number;
};

/** Starting catalogue. Only inserted when missing; admins own the values afterwards. */
export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: "FREE",
    name: "Free",
    description: "Get your showroom online.",
    audience: "ALL",
    priceKes: 0,
    periodDays: 3650,
    listingLimit: 5,
    staffLimit: 0,
    features: { advancedAnalytics: false, statusPosters: false, promotionalTools: false, leadTracking: false, storefront: false, staffAccounts: false },
    highlights: ["Up to 5 active listings", "Basic broker profile", "WhatsApp sharing", "Basic analytics"],
    sortOrder: 0,
  },
  {
    code: "PRO",
    name: "Pro",
    description: "For brokers moving cars every week.",
    audience: "BROKER",
    priceKes: 1500,
    periodDays: 30,
    listingLimit: 50,
    staffLimit: 0,
    features: { advancedAnalytics: true, statusPosters: true, promotionalTools: true, leadTracking: true, storefront: false, staffAccounts: false },
    highlights: ["Up to 50 active listings", "Advanced analytics", "WhatsApp Status posters", "Promotional tools", "Lead tracking"],
    sortOrder: 1,
  },
  {
    code: "DEALER",
    name: "Dealer",
    description: "For yards and dealerships with a team.",
    audience: "DEALER",
    priceKes: 5000,
    periodDays: 30,
    listingLimit: 300,
    staffLimit: 10,
    features: { advancedAnalytics: true, statusPosters: true, promotionalTools: true, leadTracking: true, storefront: true, staffAccounts: true },
    highlights: ["Up to 300 active listings", "Dealer storefront", "Up to 10 staff accounts", "Advanced analytics"],
    sortOrder: 2,
  },
];

export const FALLBACK_FREE_PLAN = DEFAULT_PLANS[0]!;

export async function ensureDefaultPlans(): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await SubscriptionPlan.updateOne({ code: plan.code }, { $setOnInsert: plan }, { upsert: true });
  }
}
