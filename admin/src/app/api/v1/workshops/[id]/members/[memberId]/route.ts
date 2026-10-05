import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopRole } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit";
import { WorkshopRole } from "@/generated/prisma/enums";

const patchSchema = z.object({ role: z.enum([WorkshopRole.MECHANIC, WorkshopRole.FRONTDESK, WorkshopRole.APPRENTICE]) });

async function load(workshopId: string, memberId: string) {
  const m = await prisma.workshopMember.findUnique({ where: { id: memberId } });
  if (!m || m.workshopId !== workshopId) throw new NotFoundError("Teammate not found.");
  return m;
}

// PATCH /api/v1/workshops/:id/members/:memberId — owner changes a teammate's role.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const account = await requireAccount(req);
    const { id, memberId } = await params;
    await requireWorkshopRole(account.id, id, []);
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Invalid role.", parsed.error.flatten());
    const before = await load(id, memberId);
    const updated = await prisma.workshopMember.update({ where: { id: memberId }, data: { role: parsed.data.role } });
    await writeAuditLog({ actorId: account.id, action: "workshop.member.role", entityType: "WorkshopMember", entityId: memberId, metadata: { from: before.role, to: updated.role } });
    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/v1/workshops/:id/members/:memberId — owner removes a teammate.
// The jobs stay; their assignments to this person are removed.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const account = await requireAccount(req);
    const { id, memberId } = await params;
    await requireWorkshopRole(account.id, id, []);
    await load(id, memberId);
    await prisma.workshopMember.delete({ where: { id: memberId } });
    await writeAuditLog({ actorId: account.id, action: "workshop.member.remove", entityType: "WorkshopMember", entityId: memberId });
    return apiOk({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
