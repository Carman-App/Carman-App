"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, PRIVACY_ROLES } from "@/lib/auth/rbac";
import { findPendingApproval, requestApproval } from "@/lib/approvals";

export type ActionState = { error?: string; ok?: boolean; message?: string; requestId?: string } | undefined;

// --- PRIV-01 one-action data export -----------------------------------------
//
// Exporting another person's account is an AUD-03 two-person action: the
// click records a request, and a second admin's approval (Approvals queue,
// src/lib/dangerous-actions.ts) runs the full traversal, creates the
// DataExportRequest row with per-model recordCounts (status GENERATED) and
// audit-logs it. There is no email-delivery step — Resend is a reserved,
// unconfigured env var (see .env.example) — so "delivered to the account
// holder" isn't built; the admin downloads the JSON directly via the route
// handler at /privacy/export/[requestId]/download.
export async function requestDataExport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(PRIVACY_ROLES);
  const accountId = String(formData.get("accountId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!accountId) return { error: "An account id is required." };
  if (!reason) return { error: "A reason is required to generate a data export." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: `No account found for id "${accountId}".` };
  if (await findPendingApproval("privacy.data_export", accountId)) return { error: "An export of this account is already waiting for a second admin." };

  // AUD-03: exporting another person's data needs a second admin. The export
  // is generated when a different admin approves it in Approvals.
  await requestApproval(admin, {
    action: "privacy.data_export",
    entityType: "Account",
    entityId: accountId,
    payload: { accountId, requestedByAdminId: admin.adminId },
    reason,
  });

  revalidatePath("/privacy");
  return { ok: true, message: "Export requested. It is generated once a second admin approves it in Approvals." };
}
