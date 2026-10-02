import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { getSignedReadUrl, storageConfigured } from "@/lib/storage";

// GET /api/v1/documents/:id/file — returns a 10-minute signed URL for
// the document's file. Files are private: every read is checked against the
// caller's access to the vehicle, and links expire.
// Chain: auth -> account -> document -> vehicle access -> sign.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;
    const doc = await prisma.document.findUnique({ where: { id }, select: { vehicleId: true, fileKey: true, deletedAt: true, takedownAt: true } });
    if (!doc || doc.deletedAt) throw new NotFoundError("Document not found.");
    await requireVehicleAccess(account.id, doc.vehicleId);
    if (doc.takedownAt) return apiError(410, "TAKEN_DOWN", "This file was removed by Carma. The document's details are still on record.");
    if (!doc.fileKey) throw new NotFoundError("This document has no file attached.");
    if (!storageConfigured()) return apiError(503, "STORAGE_NOT_CONFIGURED", "File storage is not set up on this server yet.");
    const url = await getSignedReadUrl(doc.fileKey, 600);
    return apiOk({ url, expiresInSeconds: 600 });
  } catch (error) {
    return handleApiError(error);
  }
}
