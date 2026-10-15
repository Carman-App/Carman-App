import { z } from "zod";
import { TOWN_NAMES } from "../constants/kenya";
import { emailSchema, kenyanPhoneSchema, paginationQuerySchema } from "./common";

const url = z.url().max(300);

export const updateBrokerProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    bio: z.string().trim().max(1000),
    phone: kenyanPhoneSchema,
    whatsappNumber: kenyanPhoneSchema,
    town: z.enum(TOWN_NAMES),
    yearsInBusiness: z.coerce.number().int().min(0).max(60),
    specialties: z.array(z.string().trim().min(1).max(40)).max(10),
    facebookUrl: url.or(z.literal("")),
    instagramUrl: url.or(z.literal("")),
    tiktokUrl: url.or(z.literal("")),
  })
  .partial();
export type UpdateBrokerProfileInput = z.input<typeof updateBrokerProfileSchema>;

export const updateDealerProfileSchema = z
  .object({
    businessName: z.string().trim().min(2).max(100),
    description: z.string().trim().max(2000),
    phone: kenyanPhoneSchema,
    whatsappNumber: kenyanPhoneSchema,
    email: emailSchema,
    town: z.enum(TOWN_NAMES),
    address: z.string().trim().max(200),
    openingHours: z.string().trim().max(200),
    website: url.or(z.literal("")),
  })
  .partial();
export type UpdateDealerProfileInput = z.input<typeof updateDealerProfileSchema>;

export const DEALER_STAFF_ROLES = ["MANAGER", "SALES"] as const;
export type DealerStaffRole = (typeof DEALER_STAFF_ROLES)[number];

export const addDealerStaffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  phone: kenyanPhoneSchema.optional(),
  staffRole: z.enum(DEALER_STAFF_ROLES).default("SALES"),
});

export const profileListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  town: z.enum(TOWN_NAMES).optional(),
  verified: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

export const VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "INFO_REQUESTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const ID_TYPES = ["NATIONAL_ID", "PASSPORT", "ALIEN_ID"] as const;
export const VERIFICATION_DOC_KINDS = ["ID_FRONT", "ID_BACK", "SELFIE", "BUSINESS_PERMIT", "KRA_PIN", "CERTIFICATE_OF_INCORPORATION", "OTHER"] as const;

export const submitVerificationSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  idType: z.enum(ID_TYPES),
  idNumber: z.string().trim().min(5).max(20).regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
  kraPin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[AP]\d{9}[A-Z]$/, "KRA PIN looks like A123456789B")
    .optional(),
  businessName: z.string().trim().max(120).optional(),
  businessRegNumber: z.string().trim().max(40).optional(),
  documents: z
    .array(z.object({ publicId: z.string().min(1).max(200), kind: z.enum(VERIFICATION_DOC_KINDS) }))
    .min(1, "Upload at least your ID")
    .max(8),
});
export type SubmitVerificationInput = z.input<typeof submitVerificationSchema>;

/** What "verified" means on this platform. Shown wherever a badge appears. */
export const VERIFICATION_EXPLAINER = {
  broker:
    "Verified seller: we have checked this seller's identity (and business documents for dealers). It does not mean we have inspected any vehicle, its condition, ownership or paperwork.",
  vehicle:
    "Verified vehicle: our team has reviewed this listing's details and documents. Still inspect the car, check the logbook and run an NTSA search before you pay.",
  safety: "Always inspect and verify a vehicle before making payment.",
} as const;
