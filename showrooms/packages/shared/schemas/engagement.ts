import { z } from "zod";
import { kenyanPhoneSchema, paginationQuerySchema } from "./common";

export const INQUIRY_TYPES = ["VIEWING_REQUEST", "QUESTION"] as const;
export const INQUIRY_STATUSES = ["NEW", "CONTACTED", "SCHEDULED", "CLOSED", "SPAM"] as const;
export type InquiryType = (typeof INQUIRY_TYPES)[number];
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const createInquirySchema = z
  .object({
    type: z.enum(INQUIRY_TYPES).default("VIEWING_REQUEST"),
    message: z.string().trim().max(1000).default(""),
    phone: kenyanPhoneSchema.optional(),
    preferredDate: z.coerce.date().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "QUESTION" && v.message.length < 5) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Write your question" });
    }
    if (v.preferredDate) {
      const now = Date.now();
      if (v.preferredDate.getTime() < now - 60 * 60_000) ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Pick a date in the future" });
      if (v.preferredDate.getTime() > now + 60 * 86_400_000) ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "Pick a date within 60 days" });
    }
  });
export type CreateInquiryInput = z.input<typeof createInquirySchema>;

export const updateInquirySchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
  sellerNote: z.string().trim().max(500).optional(),
});

export const inquiriesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(INQUIRY_STATUSES).optional(),
  type: z.enum(INQUIRY_TYPES).optional(),
});

export const REPORT_REASONS = ["SCAM", "WRONG_PRICE", "ALREADY_SOLD", "DUPLICATE", "WRONG_DETAILS", "STOLEN_PHOTOS", "OFFENSIVE", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SCAM: "Looks like a scam",
  WRONG_PRICE: "Price is misleading",
  ALREADY_SOLD: "Already sold",
  DUPLICATE: "Duplicate listing",
  WRONG_DETAILS: "Details are wrong",
  STOLEN_PHOTOS: "Photos are copied from elsewhere",
  OFFENSIVE: "Offensive content",
  OTHER: "Something else",
};
export const REPORT_STATUSES = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const createReportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).default(""),
  })
  .refine((v) => v.reason !== "OTHER" || v.details.length >= 10, { path: ["details"], message: "Tell us what is wrong" });

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""),
});

export const followTargetSchema = z.object({ targetType: z.enum(["BROKER", "DEALER"]) });
