import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageOwner } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createGarageInvitationSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { assertCanAddGarageSeat } from "@/lib/limits";
import type { GarageRole } from "@/generated/prisma/enums";

const INVITATION_TTL_DAYS = 7;

// POST /api/v1/garages/:id/invitations — invite someone by email who isn't
// on Carma yet (or isn't a member yet); GarageMember is only created once
// the invite is accepted (that acceptance flow is a later phase).
// Chain: auth -> account -> owner-level membership -> validate -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: garageId } = await params;

    await requireGarageOwner(account.id, garageId);

    const body = await req.json().catch(() => null);
    const parsed = createGarageInvitationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid invitation payload.", parsed.error.flatten());
    }

    await assertCanAddGarageSeat(garageId);

    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await prisma.garageInvitation.create({
      data: {
        garageId,
        email: parsed.data.email,
        role: parsed.data.role as GarageRole | undefined,
        invitedByAccountId: account.id,
        expiresAt,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "garage.invitation.create",
      entityType: "GarageInvitation",
      entityId: invitation.id,
      metadata: { email: parsed.data.email },
    });

    return apiOk(invitation, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
