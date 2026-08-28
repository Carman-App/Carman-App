import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateDocumentSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

async function loadDocument(id: string) {
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.deletedAt) {
    throw new NotFoundError("Document not found.");
  }
  return document;
}

// PATCH /api/v1/documents/:id
// Chain: auth -> account -> resolve document -> membership/ownership -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const document = await loadDocument(id);
    await requireVehicleAccess(account.id, document.vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid document payload.", parsed.error.flatten());
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: parsed.data.title,
        expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : undefined,
        fileKey: parsed.data.fileKey,
      },
      include: { documentType: true },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "document.update",
      entityType: "Document",
      entityId: id,
      metadata: parsed.data,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/v1/documents/:id — soft delete (deletedAt), matches
// FuelRecord/Invoice/etc. — never physically destroy vehicle history.
// Chain: auth -> account -> resolve document -> membership/ownership -> soft delete -> audit log.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const document = await loadDocument(id);
    await requireVehicleAccess(account.id, document.vehicleId);

    await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });

    await writeAuditLog({
      actorId: account.id,
      action: "document.soft_delete",
      entityType: "Document",
      entityId: id,
    });

    return apiOk({ id, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
