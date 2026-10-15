import { z } from "zod";
import { kenyanPhoneSchema, objectIdSchema, paginationQuerySchema } from "./common";

export const PAYMENT_STATUSES = ["INITIATED", "PENDING", "SUCCESS", "FAILED", "CANCELLED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_PURPOSES = ["SUBSCRIPTION", "BOOST"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];
export const SUBSCRIPTION_STATUSES = ["PENDING_PAYMENT", "ACTIVE", "EXPIRED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const BOOST_TYPES = ["BOOST", "FEATURED"] as const;
export type BoostType = (typeof BOOST_TYPES)[number];
export const BOOST_STATUSES = ["PENDING_PAYMENT", "ACTIVE", "EXPIRED", "CANCELLED"] as const;
export type BoostStatus = (typeof BOOST_STATUSES)[number];

export const PLAN_FEATURE_KEYS = ["advancedAnalytics", "statusPosters", "promotionalTools", "leadTracking", "storefront", "staffAccounts"] as const;
export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

export const planFeaturesSchema = z.object(
  Object.fromEntries(PLAN_FEATURE_KEYS.map((k) => [k, z.boolean().default(false)])) as Record<PlanFeatureKey, z.ZodDefault<z.ZodBoolean>>,
);

export const planSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/),
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300).default(""),
  audience: z.enum(["BROKER", "DEALER", "ALL"]).default("ALL"),
  priceKes: z.coerce.number().int().min(0).max(1_000_000),
  periodDays: z.coerce.number().int().min(1).max(366).default(30),
  listingLimit: z.coerce.number().int().min(0).max(100_000),
  staffLimit: z.coerce.number().int().min(0).max(500).default(0),
  features: planFeaturesSchema,
  highlights: z.array(z.string().trim().max(80)).max(10).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
export type PlanInput = z.input<typeof planSchema>;
export const updatePlanSchema = planSchema.omit({ code: true }).partial();

export const subscribeSchema = z.object({
  planCode: z.string().trim().toUpperCase().min(2).max(20),
  phone: kenyanPhoneSchema.optional(),
});

export const boostPackageSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/),
  name: z.string().trim().min(2).max(60),
  type: z.enum(BOOST_TYPES),
  days: z.coerce.number().int().min(1).max(90),
  priceKes: z.coerce.number().int().min(1).max(1_000_000),
});
export type BoostPackage = z.output<typeof boostPackageSchema>;

export const createBoostSchema = z.object({
  packageCode: z.string().trim().toUpperCase().min(2).max(30),
  phone: kenyanPhoneSchema,
});

export const paymentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PAYMENT_STATUSES).optional(),
  purpose: z.enum(PAYMENT_PURPOSES).optional(),
  userId: objectIdSchema.optional(),
  q: z.string().trim().max(60).optional(),
});
