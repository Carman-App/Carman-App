import { z } from "zod";
import { DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES, VEHICLE_LIMITS, VIDEO_MIME_TYPES } from "../constants/vehicles";
import { objectIdSchema } from "./common";

export const UPLOAD_PURPOSES = ["VEHICLE_IMAGE", "VEHICLE_VIDEO", "AVATAR", "PROFILE_LOGO", "PROFILE_COVER", "VERIFICATION_DOC"] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const UPLOAD_RULES: Record<UploadPurpose, { mime: readonly string[]; maxBytes: number; resourceType: "image" | "video" }> = {
  VEHICLE_IMAGE: { mime: IMAGE_MIME_TYPES, maxBytes: VEHICLE_LIMITS.maxImageBytes, resourceType: "image" },
  VEHICLE_VIDEO: { mime: VIDEO_MIME_TYPES, maxBytes: VEHICLE_LIMITS.maxVideoBytes, resourceType: "video" },
  AVATAR: { mime: IMAGE_MIME_TYPES, maxBytes: 5 * 1024 * 1024, resourceType: "image" },
  PROFILE_LOGO: { mime: IMAGE_MIME_TYPES, maxBytes: 5 * 1024 * 1024, resourceType: "image" },
  PROFILE_COVER: { mime: IMAGE_MIME_TYPES, maxBytes: 8 * 1024 * 1024, resourceType: "image" },
  VERIFICATION_DOC: { mime: DOCUMENT_MIME_TYPES, maxBytes: 10 * 1024 * 1024, resourceType: "image" },
};

export const uploadSignatureSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    vehicleId: objectIdSchema.optional(),
    contentType: z.string().max(100),
    fileSize: z.coerce.number().int().positive(),
  })
  .superRefine((v, ctx) => {
    const rule = UPLOAD_RULES[v.purpose];
    if (!rule.mime.includes(v.contentType)) {
      ctx.addIssue({ code: "custom", path: ["contentType"], message: `File type not allowed. Use ${rule.mime.join(", ")}` });
    }
    if (v.fileSize > rule.maxBytes) {
      ctx.addIssue({ code: "custom", path: ["fileSize"], message: `File is larger than ${Math.round(rule.maxBytes / 1024 / 1024)} MB` });
    }
    if ((v.purpose === "VEHICLE_IMAGE" || v.purpose === "VEHICLE_VIDEO") && !v.vehicleId) {
      ctx.addIssue({ code: "custom", path: ["vehicleId"], message: "vehicleId is required for vehicle media" });
    }
  });
export type UploadSignatureInput = z.input<typeof uploadSignatureSchema>;

export const uploadCompleteSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  vehicleId: objectIdSchema.optional(),
  publicId: z.string().min(1).max(200),
});
export type UploadCompleteInput = z.input<typeof uploadCompleteSchema>;

export interface UploadSignature {
  uploadUrl: string;
  /** Send these as multipart form fields along with `file`. */
  fields: Record<string, string>;
  publicId: string;
  maxBytes: number;
}
