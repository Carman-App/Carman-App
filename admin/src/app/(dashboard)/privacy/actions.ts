"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, PRIVACY_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { buildAccountDataExport } from "@/lib/privacy/export";
import type { Prisma } from "@/generated/prisma/client";
import { DataExportStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string; requestId?: string } | undefined;

// --- PRIV-01 one-action data export -----------------------------------------
//
// Generation is synchronous: the admin clicks "Generate export", the full
// traversal runs immediately, a DataExportRequest row is created with a
// per-model recordCounts summary (status GENERATED), and the reason is
// audit-logged. There is no email-delivery step — Resend is a reserved,
// unconfigured env var (see .env.example) — so "delivered to the account
// holder" isn't built; the admin downloads the JSON directly via the route
// handler at /privacy/export/[requestId]/download.
export async function requestDataExport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(PRIVACY_ROLES);
  const accountId = String(formData.get("accountId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!accountId) return { error: "An account id is required." };
  if (!reason) return { error: "A reason is required to generate a data export." };

  const payload = await buildAccountDataExport(accountId);
  if (!payload) return { error: `No account found for id "${accountId}".` };

  const request = await prisma.dataExportRequest.create({
    data: {
      accountId,
      requestedByAdminId: admin.adminId,
      reason,
      status: DataExportStatus.GENERATED,
      recordCounts: payload.recordCounts as Prisma.InputJsonValue,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "privacy.data_export_generate",
      entityType: "DataExportRequest",
      entityId: request.id,
      targetAccountId: accountId,
      reason,
      metadata: { recordCounts: payload.recordCounts },
    },
  );

  revalidatePath("/privacy");
  return { ok: true, message: "Export generated. Download it below.", requestId: request.id };
}
