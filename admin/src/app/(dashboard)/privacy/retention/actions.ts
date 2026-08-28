"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, PRIVACY_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// PRIV-04 — add/edit a data class's retention window. No purge ever runs
// against this rule (no job-queue prerequisite exists — see the page's own
// framing, matching the System surface's OPS-02/03 gap), so this is
// configuration only: what SHOULD happen, not something wired to execute.
export async function upsertRetentionRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(PRIVACY_ROLES);
  const dataClass = String(formData.get("dataClass") || "").trim();
  const retentionDaysRaw = String(formData.get("retentionDays") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!dataClass) return { error: 'A data class is required (e.g. "fuel_records").' };
  const retentionDays = Number(retentionDaysRaw);
  if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
    return { error: "Retention days must be a positive whole number." };
  }
  if (!reason) return { error: "A reason is required to add or change a retention window." };

  const existing = await prisma.retentionRule.findUnique({ where: { dataClass } });

  const rule = await prisma.retentionRule.upsert({
    where: { dataClass },
    create: { dataClass, retentionDays, description: description || null, updatedByAdminId: admin.adminId },
    update: { retentionDays, description: description || null, updatedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: existing ? "privacy.retention_rule_update" : "privacy.retention_rule_create",
      entityType: "RetentionRule",
      entityId: rule.id,
      reason,
      beforeData: existing ? { retentionDays: existing.retentionDays, description: existing.description } : null,
      afterData: { dataClass: rule.dataClass, retentionDays: rule.retentionDays, description: rule.description },
    },
  );

  revalidatePath("/privacy/retention");
  return { ok: true, message: existing ? "Retention window updated." : "Retention window added." };
}
