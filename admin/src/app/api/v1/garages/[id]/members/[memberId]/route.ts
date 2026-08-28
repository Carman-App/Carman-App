import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageOwner } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { updateGarageMemberSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { GarageRole } from "@/generated/prisma/enums";

async function loadMember(garageId: string, memberId: string) {
  const member = await prisma.garageMember.findUnique({ where: { id: memberId } });
  if (!member || member.garageId !== garageId) {
    throw new NotFoundError("Garage member not found.");
  }
  return member;
}

// PATCH /api/v1/garages/:id/members/:memberId — change role/display name.
// Chain: auth -> account -> owner-level membership -> resource -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: garageId, memberId } = await params;

    const garage = await requireGarageOwner(account.id, garageId);
    const member = await loadMember(garageId, memberId);

    const body = await req.json().catch(() => null);
    const parsed = updateGarageMemberSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid member payload.", parsed.error.flatten());
    }

    if (garage.ownerId === member.accountId && parsed.data.role && parsed.data.role !== "OWNER") {
      throw new ConflictError("Cannot demote the garage's actual owner.");
    }

    const updated = await prisma.garageMember.update({
      where: { id: memberId },
      data: {
        role: parsed.data.role as GarageRole | undefined,
        displayName: parsed.data.displayName,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "garage.member.update",
      entityType: "GarageMember",
      entityId: updated.id,
      metadata: parsed.data,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/v1/garages/:id/members/:memberId — remove a member (not the owner).
// Chain: auth -> account -> owner-level membership -> resource -> guard -> delete -> audit log.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: garageId, memberId } = await params;

    const garage = await requireGarageOwner(account.id, garageId);
    const member = await loadMember(garageId, memberId);

    if (garage.ownerId === member.accountId) {
      throw new ConflictError("Cannot remove the garage's actual owner.");
    }

    await prisma.garageMember.delete({ where: { id: memberId } });

    await writeAuditLog({
      actorId: account.id,
      action: "garage.member.remove",
      entityType: "GarageMember",
      entityId: memberId,
      metadata: { garageId },
    });

    return apiOk({ id: memberId, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
