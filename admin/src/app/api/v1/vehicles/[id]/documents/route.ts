import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { createDocumentSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

// GET /api/v1/vehicles/:id/documents — paginated.
// Chain: auth -> account -> membership/ownership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const where = { vehicleId, deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: { documentType: true },
        orderBy: { addedAt: "desc" },
        skip,
        take,
      }),
      prisma.document.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/vehicles/:id/documents
// Chain: auth -> account -> membership/ownership -> validate -> resolve document type -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid document payload.", parsed.error.flatten());
    }
    const input = parsed.data;

    let documentTypeId = input.documentTypeId;
    if (!documentTypeId && input.documentTypeCode) {
      const documentType = await prisma.documentType.findUnique({
        where: { code: input.documentTypeCode },
      });
      if (!documentType) {
        throw new NotFoundError(`Unknown document type code "${input.documentTypeCode}".`);
      }
      documentTypeId = documentType.id;
    }
    if (!documentTypeId) {
      throw new NotFoundError("documentTypeId or a valid documentTypeCode is required.");
    }

    const document = await prisma.document.create({
      data: {
        vehicleId,
        documentTypeId,
        title: input.title,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        fileKey: input.fileKey,
        uploadedByAccountId: account.id,
      },
      include: { documentType: true },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "document.create",
      entityType: "Document",
      entityId: document.id,
    });

    return apiOk(document, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
