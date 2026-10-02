import { randomUUID } from "crypto";
import type { NextRequest } from "next/server";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createUploadSchema, MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from "@/lib/api/schemas";
import { getSignedUploadUrl, storageConfigured } from "@/lib/storage";

// POST /api/v1/uploads — a short-lived URL to PUT one file (photo or PDF) for
// a vehicle straight to object storage. The returned fileKey is then sent
// with the document it belongs to. Only types and sizes listed in
// UPLOAD_CONTENT_TYPES / MAX_UPLOAD_BYTES are signed.
// Chain: auth -> account -> vehicle access -> validate -> sign.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const parsed = createUploadSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", `Upload a JPEG, PNG, HEIC, WebP or PDF up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`, parsed.error.flatten());
    }
    const { vehicleId, contentType, sizeBytes } = parsed.data;
    await requireVehicleAccess(account.id, vehicleId);
    if (!storageConfigured()) return apiError(503, "STORAGE_NOT_CONFIGURED", "File storage is not set up on this server yet.");

    const fileKey = `vehicles/${vehicleId}/${randomUUID()}.${UPLOAD_CONTENT_TYPES[contentType]}`;
    const uploadUrl = await getSignedUploadUrl(fileKey, contentType, sizeBytes);
    return apiOk({ fileKey, uploadUrl, method: "PUT", headers: { "Content-Type": contentType }, expiresInSeconds: 300 }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
