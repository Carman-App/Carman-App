"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { approveAndExecute, rejectApproval, ApprovalError } from "@/lib/approvals";
import { DANGEROUS_ACTIONS } from "@/lib/dangerous-actions";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

/**
 * AUD-03 approval queue. Approving runs the stored request through its
 * executor in src/lib/dangerous-actions.ts; approveAndExecute refuses when
 * the approver is the requester. Only actions registered there can be
 * approved here — garage handover and large refunds keep their own pages.
 */
export async function approveRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const approvalId = String(formData.get("approvalId") || "");
  const approval = await prisma.twoPersonApproval.findUnique({ where: { id: approvalId } });
  if (!approval) return { error: "Request not found." };
  const def = DANGEROUS_ACTIONS[approval.action];
  if (!def) return { error: "This request is approved from its own page." };
  const admin = await requireRole(def.roles);

  try {
    const message = await approveAndExecute(admin, approvalId, (payload) => def.execute(admin, payload, approval.reason));
    revalidatePath("/approvals");
    revalidatePath(def.href(approval.payload as Record<string, unknown>));
    return { ok: true, message };
  } catch (err) {
    revalidatePath("/approvals");
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not carry out this request." };
  }
}

export async function rejectRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const approvalId = String(formData.get("approvalId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "Say why it is rejected." };
  const approval = await prisma.twoPersonApproval.findUnique({ where: { id: approvalId } });
  if (!approval) return { error: "Request not found." };
  const def = DANGEROUS_ACTIONS[approval.action];
  if (!def) return { error: "This request is decided from its own page." };
  const admin = await requireRole(def.roles);

  try {
    await rejectApproval(admin, approvalId, reason);
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    throw err;
  }
  revalidatePath("/approvals");
  return { ok: true, message: "Rejected. Nothing was changed." };
}
