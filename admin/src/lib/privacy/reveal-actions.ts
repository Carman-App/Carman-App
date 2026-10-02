"use server";

import { requireRole, MASKED_MONEY_REVEAL_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

export type RevealState = { error?: string; ok?: boolean } | undefined;

/**
 * PRIV-05 reveal-with-reason. Mirrors the AUD-06 access-event-logging
 * pattern referenced in src/lib/audit.ts's doc-comment: revealing a masked
 * amount is itself a loggable access event, not a data mutation — this
 * action never reads or writes the underlying Payment/Invoice/RefundCredit/
 * FailedPayment/FuelRecord/etc. row, only records that an admin chose to see
 * a real value and why. Gated by MASKED_MONEY_REVEAL_ROLES — the union of
 * every role roster that can reach a page using MaskedMoney (Money's billing
 * pages, and DATA-03's flagged-records list), not the stricter
 * PRIVACY_ROLES — see rbac.ts's doc-comment on that constant.
 */
export async function revealMaskedAmount(_prev: RevealState, formData: FormData): Promise<RevealState> {
  const admin = await requireRole(MASKED_MONEY_REVEAL_ROLES);
  const entityType = String(formData.get("entityType") || "").trim();
  const entityId = String(formData.get("entityId") || "").trim();
  const fieldLabel = String(formData.get("fieldLabel") || "amount").trim();
  const targetAccountIdRaw = formData.get("targetAccountId");
  const targetAccountId = targetAccountIdRaw ? String(targetAccountIdRaw) : null;
  const reason = String(formData.get("reason") || "").trim();

  if (!entityType || !entityId) return { error: "Missing record reference." };
  if (!reason) return { error: "A reason is required to reveal this amount." };

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "privacy.reveal_masked_amount",
      entityType,
      entityId,
      targetAccountId,
      reason,
      metadata: { fieldLabel },
    },
  );

  return { ok: true };
}
