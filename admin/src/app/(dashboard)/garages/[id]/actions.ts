"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, GARAGE_ROLES, GARAGE_TRANSFER_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { requestApproval, approveAndExecute, rejectApproval, ApprovalError } from "@/lib/approvals";
import { notify } from "@/lib/notifications/provider";
import { NotificationType } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// --- GAR-02 remove a member (retain as "former", never delete the row) -----

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(GARAGE_ROLES);
  const memberId = String(formData.get("memberId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!memberId) return { error: "Pick a member to remove." };
  if (!reason) return { error: "A reason is required to remove a member." };

  const member = await prisma.garageMember.findUnique({ where: { id: memberId } });
  if (!member) return { error: "Member not found." };
  if (member.removedAt) return { error: "That member is already former." };

  const now = new Date();
  await prisma.garageMember.update({
    where: { id: memberId },
    data: { removedAt: now, removedReason: reason, removedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(admin, {
    action: "garage.member_remove",
    entityType: "GarageMember",
    entityId: memberId,
    targetAccountId: member.accountId,
    reason,
    beforeData: { removedAt: null, removedReason: null, removedByAdminId: null },
    afterData: { removedAt: now, removedReason: reason, removedByAdminId: admin.adminId },
  });

  revalidatePath(`/garages/${member.garageId}`);
  return { ok: true, message: "Member removed — retained on this page as a former member." };
}

// --- GAR-07 garage ownership handover (two-person approval) ----------------

export async function requestGarageTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(GARAGE_TRANSFER_ROLES);
  const garageId = String(formData.get("garageId") || "");
  const newOwnerAccountId = String(formData.get("newOwnerAccountId") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!newOwnerAccountId) return { error: "Pick the current member who will become the new owner." };
  if (!reason) return { error: "A reason is required to request an ownership handover." };

  const garage = await prisma.garage.findUnique({ where: { id: garageId } });
  if (!garage) return { error: "Garage not found." };
  if (garage.ownerId === newOwnerAccountId) return { error: "That account already owns this garage." };

  const member = await prisma.garageMember.findFirst({
    where: { garageId, accountId: newOwnerAccountId, removedAt: null },
  });
  if (!member) return { error: "The new owner must be a current member of this garage." };

  const existingPending = await prisma.twoPersonApproval.findFirst({
    where: { entityType: "Garage", entityId: garageId, action: "garage.transfer_owner", status: "PENDING" },
  });
  if (existingPending) return { error: "A transfer request is already pending for this garage." };

  await requestApproval(admin, {
    action: "garage.transfer_owner",
    entityType: "Garage",
    entityId: garageId,
    payload: { garageId, newOwnerAccountId },
    reason,
  });

  revalidatePath(`/garages/${garageId}`);
  return { ok: true, message: "Handover requested — needs a second OWNER-role admin to approve." };
}

export async function approveGarageTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(GARAGE_TRANSFER_ROLES);
  const approvalId = String(formData.get("approvalId") || "");
  const garageId = String(formData.get("garageId") || "");

  try {
    await approveAndExecute(admin, approvalId, async (payload) => {
      const p = payload as { garageId: string; newOwnerAccountId: string };
      const garage = await prisma.garage.findUnique({ where: { id: p.garageId } });
      if (!garage) throw new Error("Garage not found.");
      const oldOwnerId = garage.ownerId;

      const updated = await prisma.garage.update({
        where: { id: p.garageId },
        data: { ownerId: p.newOwnerAccountId },
      });

      const currentMembers = await prisma.garageMember.findMany({
        where: { garageId: p.garageId, removedAt: null },
        select: { accountId: true },
      });
      const notifyAccountIds = new Set<string>([oldOwnerId, p.newOwnerAccountId, ...currentMembers.map((m) => m.accountId)]);

      await Promise.all(
        [...notifyAccountIds].map((accountId) =>
          notify({
            accountId,
            type: NotificationType.GENERIC,
            title: "Garage ownership transferred",
            body: `${garage.name} was handed over to a new owner by Carma support.`,
            metadata: { garageId: p.garageId, oldOwnerId, newOwnerAccountId: p.newOwnerAccountId },
          }),
        ),
      );

      return updated;
    });
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not approve this transfer." };
  }

  revalidatePath(`/garages/${garageId}`);
  return { ok: true, message: "Ownership transferred and every current member notified." };
}

export async function rejectGarageTransfer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(GARAGE_TRANSFER_ROLES);
  const approvalId = String(formData.get("approvalId") || "");
  const garageId = String(formData.get("garageId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to reject a transfer request." };

  try {
    await rejectApproval(admin, approvalId, reason);
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not reject this transfer." };
  }

  revalidatePath(`/garages/${garageId}`);
  return { ok: true, message: "Transfer request rejected." };
}
