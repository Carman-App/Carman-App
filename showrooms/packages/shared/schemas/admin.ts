import { z } from "zod";
import { BODY_TYPES, VEHICLE_STATUSES } from "../constants/vehicles";
import { boostPackageSchema } from "./billing";
import { objectIdSchema, paginationQuerySchema } from "./common";
import { REPORT_STATUSES } from "./engagement";
import { VERIFICATION_STATUSES } from "./profiles";

export const MODERATION_ACTIONS = ["APPROVE", "REJECT", "REQUEST_CHANGES", "SUSPEND", "REINSTATE"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const moderateVehicleSchema = z
  .object({
    action: z.enum(MODERATION_ACTIONS),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.action === "APPROVE" || v.action === "REINSTATE" || (v.reason?.length ?? 0) >= 5, {
    path: ["reason"],
    message: "Give the seller a reason",
  });

export const featureVehicleSchema = z.object({
  featured: z.boolean(),
  days: z.coerce.number().int().min(1).max(365).default(7),
});

export const verifyVehicleSchema = z.object({ verified: z.boolean(), note: z.string().trim().max(500).optional() });

export const adminVehiclesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(VEHICLE_STATUSES).optional(),
  flagged: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  sellerId: objectIdSchema.optional(),
  q: z.string().trim().max(80).optional(),
});

export const verificationDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT", "REQUEST_INFO"]),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.decision === "APPROVE" || (v.notes?.length ?? 0) >= 5, { path: ["notes"], message: "Tell the seller why" });

export const verificationsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(VERIFICATION_STATUSES).optional(),
  subjectType: z.enum(["BROKER", "DEALER"]).optional(),
});

export const reportsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(REPORT_STATUSES).optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]),
  resolution: z.string().trim().max(1000).optional(),
  /** Optionally suspend the listing in the same step. */
  suspendVehicle: z.boolean().default(false),
});

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.string().trim().max(60).optional(),
  actorId: objectIdSchema.optional(),
  entityId: objectIdSchema.optional(),
});

export const analyticsRangeSchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(30),
});

export const CATEGORY_KINDS = ["MAKE", "BODY_TYPE"] as const;
export const categorySchema = z.object({
  kind: z.enum(CATEGORY_KINDS),
  name: z.string().trim().min(1).max(40),
  models: z.array(z.string().trim().min(1).max(60)).max(200).default([]),
  bodyType: z.enum(BODY_TYPES).optional(),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});
export const updateCategorySchema = categorySchema.omit({ kind: true }).partial();

export const platformSettingsSchema = z
  .object({
    requireListingApproval: z.boolean(),
    autoApproveVerifiedSellers: z.boolean(),
    supportPhone: z.string().trim().max(20),
    supportEmail: z.email(),
    boostPackages: z.array(boostPackageSchema).max(10),
    reportAutoFlagThreshold: z.coerce.number().int().min(1).max(50),
    soldListingVisibleDays: z.coerce.number().int().min(0).max(90),
  })
  .partial();
export type PlatformSettingsInput = z.input<typeof platformSettingsSchema>;
