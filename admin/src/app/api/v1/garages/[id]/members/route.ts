import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership, requireGarageOwner } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { addGarageMemberSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { GarageRole } from "@/generated/prisma/enums";

// GET /api/v1/garages/:id/members
// Chain: auth -> account -> membership -> list.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: garageId } = await params;

    await requireGarageMembership(account.id, garageId);

    const members = await prisma.garageMember.findMany({
      where: { garageId },
      orderBy: { joinedAt: "asc" },
    });

    return apiOk(members);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/garages/:id/members — add an existing Account directly as a
// member (distinct from the invite-by-email flow at .../invitations).
// Chain: auth -> account -> owner-level membership -> validate -> target account exists -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: garageId } = await params;

    await requireGarageOwner(account.id, garageId);

    const body = await req.json().catch(() => null);
    const parsed = addGarageMemberSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid member payload.", parsed.error.flatten());
    }

    const targetAccount = await prisma.account.findUnique({ where: { id: parsed.data.accountId } });
    if (!targetAccount) {
      throw new NotFoundError("Account to add was not found.");
    }

    const existing = await prisma.garageMember.findUnique({
      where: { garageId_accountId: { garageId, accountId: parsed.data.accountId } },
    });
    if (existing) {
      throw new ConflictError("This account is already a member of the garage.");
    }

    const member = await prisma.garageMember.create({
      data: {
        garageId,
        accountId: parsed.data.accountId,
        role: parsed.data.role as GarageRole | undefined,
        displayName: parsed.data.displayName,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "garage.member.add",
      entityType: "GarageMember",
      entityId: member.id,
      metadata: { garageId, accountId: parsed.data.accountId },
    });

    return apiOk(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
