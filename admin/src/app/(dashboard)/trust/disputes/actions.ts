"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { DisputeStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

export async function resolveDispute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_ROLES);
  const disputeId = String(formData.get("disputeId") || "");
  const outcome = String(formData.get("outcome") || ""); // "RESOLVED" | "DISMISSED"
  const resolutionNote = String(formData.get("resolutionNote") || "").trim();

  if (outcome !== DisputeStatus.RESOLVED && outcome !== DisputeStatus.DISMISSED) {
    return { error: "Pick either Resolved or Dismissed." };
  }
  if (!resolutionNote) return { error: "A resolution note is required." };

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) return { error: "Dispute not found." };
  if (dispute.status !== DisputeStatus.OPEN) return { error: "Already decided." };

  const now = new Date();
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: outcome as DisputeStatus,
      resolutionNote,
      resolvedByAdminId: admin.adminId,
      resolvedAt: now,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.dispute_resolve",
      entityType: "Dispute",
      entityId: disputeId,
      targetAccountId: dispute.raisedByAccountId,
      reason: resolutionNote,
      afterData: { status: outcome },
    },
  );

  revalidatePath(`/trust/disputes/${disputeId}`);
  revalidatePath("/trust/disputes");
  return { ok: true, message: `Dispute ${outcome.toLowerCase()}.` };
}
