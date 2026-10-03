import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { updateWorkshopSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { ForbiddenError } from "@/lib/api/auth";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// GET /api/v1/workshops/:id
// Chain: auth -> account -> membership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireWorkshopMembership(account.id, id);

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!workshop) {
      throw new NotFoundError("Workshop not found.");
    }

    return apiOk(workshop);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/v1/workshops/:id — name, town, how the workshop works. Owner only.
// Chain: auth -> account -> owner check -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;
    const workshop = await prisma.workshop.findUnique({ where: { id }, select: { ownerId: true } });
    if (!workshop) throw new NotFoundError("Workshop not found.");
    if (workshop.ownerId !== account.id) throw new ForbiddenError("Only the workshop owner can change it.");

    const parsed = updateWorkshopSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid workshop payload.", parsed.error.flatten());
    }
    const updated = await prisma.workshop.update({ where: { id }, data: parsed.data });
    await writeAuditLog({ actorId: account.id, action: "workshop.update", entityType: "Workshop", entityId: id, metadata: parsed.data });
    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
