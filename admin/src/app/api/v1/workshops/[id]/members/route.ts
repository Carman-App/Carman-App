import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership, requireWorkshopRole } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { assertCanAddWorkshopStaff } from "@/lib/limits";
import { writeAuditLog } from "@/lib/audit";
import { WorkshopRole } from "@/generated/prisma/enums";

/** Roles an owner can give. OWNER is the workshop's owner and is not handed out here. */
const STAFF_ROLES = [WorkshopRole.MECHANIC, WorkshopRole.FRONTDESK, WorkshopRole.APPRENTICE] as const;

// GET /api/v1/workshops/:id/members — the owner and every staff member with their role.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;
    await requireWorkshopMembership(account.id, id);
    const workshop = await prisma.workshop.findUniqueOrThrow({
      where: { id },
      select: {
        ownerId: true,
        owner: { select: { user: { select: { name: true, email: true } } } },
        members: { orderBy: { joinedAt: "asc" }, select: { id: true, accountId: true, role: true, displayName: true, joinedAt: true, account: { select: { user: { select: { email: true } } } } } },
      },
    });
    const owner = { id: `owner:${workshop.ownerId}`, accountId: workshop.ownerId, role: WorkshopRole.OWNER, displayName: workshop.owner.user.name, email: workshop.owner.user.email, joinedAt: null };
    const staff = workshop.members
      .filter((m) => m.accountId !== workshop.ownerId)
      .map((m) => ({ id: m.id, accountId: m.accountId, role: m.role, displayName: m.displayName, email: m.account.user.email, joinedAt: m.joinedAt }));
    return apiOk([owner, ...staff]);
  } catch (error) {
    return handleApiError(error);
  }
}

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(STAFF_ROLES),
  displayName: z.string().trim().max(120).optional(),
});

// POST /api/v1/workshops/:id/members — the owner adds someone who already has
// a Carma account, as mechanic, front desk or apprentice. Counts against the
// plan's staff limit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;
    await requireWorkshopRole(account.id, id, []); // owner only
    const parsed = addSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Invalid teammate.", parsed.error.flatten());
    const { email, role, displayName } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, select: { name: true, account: { select: { id: true, deletedAt: true } } } });
    if (!user?.account || user.account.deletedAt) {
      return apiError(404, "NOT_FOUND", "No Carma account uses that email yet. Ask them to install Carma and sign in, then add them.");
    }
    const existing = await prisma.workshopMember.findUnique({ where: { workshopId_accountId: { workshopId: id, accountId: user.account.id } } });
    if (existing) return apiError(409, "CONFLICT", "They are already on this workshop's team.");

    await assertCanAddWorkshopStaff(id);
    const member = await prisma.workshopMember.create({
      data: { workshopId: id, accountId: user.account.id, role, displayName: displayName || user.name || email.split("@")[0] },
    });
    await writeAuditLog({ actorId: account.id, action: "workshop.member.add", entityType: "WorkshopMember", entityId: member.id, metadata: { role } });
    return apiOk(member, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
