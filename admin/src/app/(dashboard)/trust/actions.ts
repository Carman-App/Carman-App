"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { AbuseReportStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// TRUST-01 — one queue for user reports. Nothing in the mobile app creates
// these yet (no in-app "report" button exists per Phase One's scope), so
// this also doubles as the admin-initiated "log a report" form for reports
// that come in via phone/email.

export async function logAbuseReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_ROLES);
  const reportedAccountId = String(formData.get("reportedAccountId") || "").trim();
  const reporterAccountId = String(formData.get("reporterAccountId") || "").trim();
  const reportedEntityType = String(formData.get("reportedEntityType") || "").trim();
  const reportedEntityId = String(formData.get("reportedEntityId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!reportedAccountId) return { error: "The reported account id is required." };
  if (!reason) return { error: "A reason is required." };

  const reportedAccount = await prisma.account.findUnique({ where: { id: reportedAccountId } });
  if (!reportedAccount) return { error: "No account with that reported-account id." };

  if (reporterAccountId) {
    const reporterAccount = await prisma.account.findUnique({ where: { id: reporterAccountId } });
    if (!reporterAccount) return { error: "No account with that reporter-account id." };
  }

  const report = await prisma.abuseReport.create({
    data: {
      reportedAccountId,
      reporterAccountId: reporterAccountId || null,
      reportedEntityType: reportedEntityType || null,
      reportedEntityId: reportedEntityId || null,
      reason,
      description: description || null,
      status: AbuseReportStatus.OPEN,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.abuse_report_logged",
      entityType: "AbuseReport",
      entityId: report.id,
      targetAccountId: reportedAccountId,
      reason,
    },
  );

  revalidatePath("/trust");
  return { ok: true, message: "Report logged." };
}

export async function markReportInReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_ROLES);
  const reportId = String(formData.get("reportId") || "");

  const report = await prisma.abuseReport.findUnique({ where: { id: reportId } });
  if (!report) return { error: "Report not found." };

  await prisma.abuseReport.update({ where: { id: reportId }, data: { status: AbuseReportStatus.IN_REVIEW } });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.abuse_report_in_review",
      entityType: "AbuseReport",
      entityId: reportId,
      targetAccountId: report.reportedAccountId,
    },
  );

  revalidatePath(`/trust/reports/${reportId}`);
  revalidatePath("/trust");
  return { ok: true };
}

export async function decideAbuseReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_ROLES);
  const reportId = String(formData.get("reportId") || "");
  const decision = String(formData.get("decision") || ""); // "ACTIONED" | "DISMISSED"
  const actionTaken = String(formData.get("actionTaken") || "").trim();

  if (decision !== AbuseReportStatus.ACTIONED && decision !== AbuseReportStatus.DISMISSED) {
    return { error: "Pick either Actioned or Dismissed." };
  }
  if (decision === AbuseReportStatus.ACTIONED && !actionTaken) {
    return { error: "A note on what action was taken is required to mark a report Actioned." };
  }

  const report = await prisma.abuseReport.findUnique({ where: { id: reportId } });
  if (!report) return { error: "Report not found." };

  const now = new Date();
  await prisma.abuseReport.update({
    where: { id: reportId },
    data: {
      status: decision as AbuseReportStatus,
      actionTaken: actionTaken || null,
      decidedByAdminId: admin.adminId,
      decidedAt: now,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.abuse_report_decide",
      entityType: "AbuseReport",
      entityId: reportId,
      targetAccountId: report.reportedAccountId,
      reason: actionTaken || undefined,
      afterData: { status: decision },
    },
  );

  revalidatePath(`/trust/reports/${reportId}`);
  revalidatePath("/trust");
  return { ok: true, message: `Report marked ${decision.toLowerCase()}.` };
}
