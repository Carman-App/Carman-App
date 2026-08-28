import "server-only";
import { prisma } from "@/lib/prisma";
import { ApprovalStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { writeAdminAuditLog } from "@/lib/audit";
import type { CurrentSession } from "@/lib/auth/session";

/**
 * Generic two-person approval, shared by every Phase Two action that needs
 * a second admin's sign-off in addition to a required reason — today that's
 * GAR-07 (garage ownership handover) and MON-07 (refund/credit above a
 * threshold). See AGENTS.md: "requires reason + second approval (two-person,
 * per Phase One's audit foundation)".
 *
 * Flow: requestApproval() records exactly what will execute (the payload)
 * and why. A *different* admin than the requester calls approveAndExecute()
 * with the executor function that performs the real mutation — the
 * approval row is what proves a second, distinct admin signed off; nothing
 * here trusts a client-supplied "approved" flag. Rejecting or cancelling
 * never executes anything.
 */

export type ApprovalPayload = Record<string, unknown>;

export async function requestApproval(
  admin: Pick<CurrentSession, "adminId">,
  input: {
    action: string;
    entityType: string;
    entityId: string;
    payload: ApprovalPayload;
    reason: string;
  },
): Promise<{ id: string }> {
  if (!input.reason.trim()) {
    throw new Error("A reason is required to request approval.");
  }
  const approval = await prisma.twoPersonApproval.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload as Prisma.InputJsonValue,
      reason: input.reason.trim(),
      requestedByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(admin, {
    action: `${input.action}.request_approval`,
    entityType: input.entityType,
    entityId: input.entityId,
    reason: input.reason,
    metadata: { approvalId: approval.id, payload: input.payload },
  });

  return { id: approval.id };
}

export class ApprovalError extends Error {}

/**
 * Approves a pending request and immediately runs `execute` with its
 * payload — both steps happen in one call so there is never a window where
 * an approval is marked APPROVED but not yet executed (or executed twice).
 * Throws if the approving admin is the same as the requester (no
 * self-approval — see AGENTS.md "Cannot: approve their own two-person
 * action"), or if the approval isn't PENDING.
 */
export async function approveAndExecute<T>(
  admin: Pick<CurrentSession, "adminId">,
  approvalId: string,
  execute: (payload: ApprovalPayload) => Promise<T>,
): Promise<T> {
  const approval = await prisma.twoPersonApproval.findUnique({ where: { id: approvalId } });
  if (!approval) throw new ApprovalError("Approval request not found.");
  if (approval.status !== ApprovalStatus.PENDING) {
    throw new ApprovalError(`This request is already ${approval.status.toLowerCase()}.`);
  }
  if (approval.requestedByAdminId === admin.adminId) {
    throw new ApprovalError("The admin who requested this cannot also approve it.");
  }

  await prisma.twoPersonApproval.update({
    where: { id: approvalId },
    data: { status: ApprovalStatus.APPROVED, approvedByAdminId: admin.adminId, approvedAt: new Date() },
  });

  try {
    const result = await execute(approval.payload as ApprovalPayload);
    await prisma.twoPersonApproval.update({
      where: { id: approvalId },
      data: { status: ApprovalStatus.EXECUTED, executedAt: new Date() },
    });
    await writeAdminAuditLog(admin, {
      action: `${approval.action}.approve_and_execute`,
      entityType: approval.entityType,
      entityId: approval.entityId,
      reason: approval.reason,
      metadata: { approvalId: approval.id, requestedByAdminId: approval.requestedByAdminId },
    });
    return result;
  } catch (err) {
    await prisma.twoPersonApproval.update({
      where: { id: approvalId },
      data: { executionError: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}

export async function rejectApproval(
  admin: Pick<CurrentSession, "adminId">,
  approvalId: string,
  rejectedReason: string,
): Promise<void> {
  const approval = await prisma.twoPersonApproval.findUnique({ where: { id: approvalId } });
  if (!approval) throw new ApprovalError("Approval request not found.");
  if (approval.status !== ApprovalStatus.PENDING) {
    throw new ApprovalError(`This request is already ${approval.status.toLowerCase()}.`);
  }
  await prisma.twoPersonApproval.update({
    where: { id: approvalId },
    data: { status: ApprovalStatus.REJECTED, approvedByAdminId: admin.adminId, approvedAt: new Date(), rejectedReason },
  });
  await writeAdminAuditLog(admin, {
    action: `${approval.action}.reject_approval`,
    entityType: approval.entityType,
    entityId: approval.entityId,
    reason: rejectedReason,
    metadata: { approvalId: approval.id },
  });
}

export async function listPendingApprovals(entityType?: string) {
  return prisma.twoPersonApproval.findMany({
    where: { status: ApprovalStatus.PENDING, ...(entityType ? { entityType } : {}) },
    orderBy: { requestedAt: "desc" },
  });
}
