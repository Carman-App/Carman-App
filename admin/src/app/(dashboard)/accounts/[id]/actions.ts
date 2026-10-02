"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireRole,
  ACCOUNT_QUICK_ACTION_ROLES,
  ACCOUNT_DANGEROUS_ACTION_ROLES,
} from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { requestApproval, approveAndExecute, rejectApproval, ApprovalError } from "@/lib/approvals";
import {
  SuspensionReason,
  VerificationSource,
  Region,
  InvitationStatus,
  BackgroundJobStatus,
} from "@/generated/prisma/enums";
import { enqueueJob } from "@/lib/queue/queue";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const DELETE_GRACE_WINDOW_DAYS = 30;

// --- Support quick-actions -------------------------------------------------
// Per AGENTS.md: there is no real end-user auth/OTP/session/lock system yet
// (src/lib/api/auth.ts is a dev header stub — "real end-user auth is a
// later phase"). Resend/reset/unlock are honest no-ops: they record operator
// intent in the append-only audit log and say plainly that nothing was
// actually sent/unlocked, rather than faking success.

async function recordHonestNoOp(
  accountId: string,
  action: string,
  note: string,
): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_QUICK_ACTION_ROLES);
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action,
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
      metadata: { note },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Recorded — no live channel is wired up yet to actually send this." };
}

export async function resendVerificationCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const accountId = String(formData.get("accountId") || "");
  return recordHonestNoOp(
    accountId,
    "account.resend_code",
    "No real OTP/session system exists yet — this records operator intent; wire to a real provider when end-user auth lands.",
  );
}

export async function resetSignIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const accountId = String(formData.get("accountId") || "");
  return recordHonestNoOp(
    accountId,
    "account.reset_sign_in",
    "No real OTP/session system exists yet — this records operator intent; wire to a real provider when end-user auth lands.",
  );
}

export async function unlockAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const accountId = String(formData.get("accountId") || "");
  return recordHonestNoOp(
    accountId,
    "account.unlock",
    "No account-lock concept exists in the schema yet (no Account.lockedAt field) — this records operator intent only. A real unlock needs that field added; flagged for the lead agent.",
  );
}

// --- SUP-04 remaining common fixes ("resend invite", "re-issue report link",
// "re-run failed export") — the first two named channels (email/SMS) have no
// live provider connected, same honest-no-op pattern as resend/reset/unlock
// above; the DB write each one makes is real (a genuinely extended
// invitation expiry, a genuinely fresh Report + queued report.generate job,
// or a genuinely re-queued BackgroundJob), and each is a single logged
// action, per the story.

export async function resendGarageInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_QUICK_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { user: true } });
  if (!account) return { error: "Account not found." };

  const invitation = await prisma.garageInvitation.findFirst({
    where: { email: account.user.email, status: InvitationStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });
  if (!invitation) return { error: "No pending garage invitation on file for this account's email." };

  const before = { expiresAt: invitation.expiresAt };
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.garageInvitation.update({ where: { id: invitation.id }, data: { expiresAt: newExpiresAt } });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.resend_garage_invite",
      entityType: "GarageInvitation",
      entityId: invitation.id,
      targetAccountId: accountId,
      beforeData: before,
      afterData: { expiresAt: newExpiresAt },
      metadata: {
        note: "No email/SMS provider is connected — the invitation's expiry was genuinely extended, but nothing was actually re-sent to the invitee.",
      },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return {
    ok: true,
    message: `Invitation expiry extended to ${newExpiresAt.toDateString()} — not actually re-sent (no email/SMS provider connected).`,
  };
}

export async function reissueReportLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_QUICK_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };

  const lastReport = await prisma.report.findFirst({
    where: { generatedByAccountId: accountId },
    orderBy: { generatedAt: "desc" },
  });
  if (!lastReport) return { error: "No report has ever been generated for this account." };

  const newReport = await prisma.report.create({
    data: {
      scope: lastReport.scope,
      scopeId: lastReport.scopeId,
      periodLabel: lastReport.periodLabel,
      generatedByAccountId: accountId,
      format: lastReport.format,
    },
  });
  const job = await enqueueJob(
    "report.generate",
    { reportId: newReport.id, scope: newReport.scope, scopeId: newReport.scopeId },
    { dedupeKey: `report.generate:${newReport.id}` },
  );

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.reissue_report_link",
      entityType: "Report",
      entityId: newReport.id,
      targetAccountId: accountId,
      metadata: { previousReportId: lastReport.id, jobId: job.id },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return {
    ok: true,
    message: "Re-issued — a fresh report was queued (no PDF/CSV renderer exists yet, same honest gap as the original).",
  };
}

export async function rerunFailedExport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_QUICK_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };

  const reports = await prisma.report.findMany({ where: { generatedByAccountId: accountId }, select: { id: true } });
  const reportIds = new Set(reports.map((r) => r.id));
  if (reportIds.size === 0) return { error: "No report/export has ever been generated for this account." };

  // BackgroundJob.payload is JSON keyed by reportId, not a relation column —
  // scan the most recent FAILED report.generate jobs platform-wide (bounded)
  // for one whose payload names a report belonging to this account.
  const failedJobs = await prisma.backgroundJob.findMany({
    where: { type: "report.generate", status: BackgroundJobStatus.FAILED },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const failedJob = failedJobs.find((j) => reportIds.has((j.payload as { reportId?: string } | null)?.reportId ?? ""));
  if (!failedJob) return { error: "No failed export/report job on file for this account." };

  await prisma.backgroundJob.update({
    where: { id: failedJob.id },
    data: { status: BackgroundJobStatus.PENDING, attempts: 0, lastError: null, runAt: new Date(), lockedAt: null, lockedBy: null },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.rerun_failed_export",
      entityType: "BackgroundJob",
      entityId: failedJob.id,
      targetAccountId: accountId,
      metadata: { previousError: failedJob.lastError },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Re-queued — the failed job will be retried by the queue worker." };
}

// --- ACCT-05 manual verification (real) ------------------------------------

export async function manualVerifyEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_QUICK_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to manually verify an email." };

  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { user: true } });
  if (!account) return { error: "Account not found." };

  const before = {
    emailVerifiedAt: account.user.emailVerifiedAt,
    emailVerifiedSource: account.user.emailVerifiedSource,
    emailVerifiedByAdminId: account.user.emailVerifiedByAdminId,
  };
  const now = new Date();

  await prisma.user.update({
    where: { id: account.userId },
    data: {
      emailVerifiedAt: now,
      emailVerifiedSource: VerificationSource.ADMIN,
      emailVerifiedByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.email_verify_admin",
      entityType: "User",
      entityId: account.userId,
      targetAccountId: accountId,
      reason,
      beforeData: before,
      afterData: { emailVerifiedAt: now, emailVerifiedSource: VerificationSource.ADMIN, emailVerifiedByAdminId: admin.adminId },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Email marked verified (admin)." };
}

// --- ACCT-06 suspend / unsuspend --------------------------------------------

const SUSPENSION_REASONS = Object.values(SuspensionReason) as string[];

export async function suspendAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const reason = String(formData.get("suspendReason") || "");
  const note = String(formData.get("note") || "").trim();

  if (!SUSPENSION_REASONS.includes(reason)) return { error: "Pick a reason from the list." };
  if (!note) return { error: "A note is required in addition to the reason." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };
  if (account.suspendedAt) return { error: "Already suspended." };

  const before = {
    suspendedAt: account.suspendedAt,
    suspendedReason: account.suspendedReason,
    suspendedNote: account.suspendedNote,
    suspendedByAdminId: account.suspendedByAdminId,
  };
  const now = new Date();

  await prisma.account.update({
    where: { id: accountId },
    data: {
      suspendedAt: now,
      suspendedReason: reason as SuspensionReason,
      suspendedNote: note,
      suspendedByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.suspend",
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
      reason: note,
      beforeData: before,
      afterData: { suspendedAt: now, suspendedReason: reason, suspendedNote: note, suspendedByAdminId: admin.adminId },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Account suspended." };
}

export async function unsuspendAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to unsuspend." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };
  if (!account.suspendedAt) return { error: "Not suspended." };

  const before = {
    suspendedAt: account.suspendedAt,
    suspendedReason: account.suspendedReason,
    suspendedNote: account.suspendedNote,
    suspendedByAdminId: account.suspendedByAdminId,
  };

  await prisma.account.update({
    where: { id: accountId },
    data: { suspendedAt: null, suspendedReason: null, suspendedNote: null, suspendedByAdminId: null },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.unsuspend",
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
      reason,
      beforeData: before,
      afterData: { suspendedAt: null, suspendedReason: null, suspendedNote: null, suspendedByAdminId: null },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Account unsuspended." };
}

// --- ACCT-07 delete / restore ------------------------------------------------
// AUD-03: "Two-person approval required for: account deletion ... ." This
// reuses the same generic two-person mechanism already wired for GAR-07
// (garage handover) and MON-07 (refunds above threshold) — see
// src/lib/approvals.ts. Restore is deliberately NOT two-person: AUD-03's
// list names "account deletion" only, and restore is the harm-reversing
// mirror of it (see NOT-03), so it stays a single-admin action as before.

export async function requestAccountDeletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to request an account deletion." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };
  if (account.deletedAt) return { error: "Already deleted." };

  const existingPending = await prisma.twoPersonApproval.findFirst({
    where: { entityType: "Account", entityId: accountId, action: "account.delete", status: "PENDING" },
  });
  if (existingPending) return { error: "A deletion request is already pending for this account." };

  await requestApproval(admin, {
    action: "account.delete",
    entityType: "Account",
    entityId: accountId,
    payload: { accountId },
    reason,
  });

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Deletion requested — needs a second OWNER-role admin to approve." };
}

export async function approveAccountDeletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const approvalId = String(formData.get("approvalId") || "");
  const accountId = String(formData.get("accountId") || "");

  const approvalRow = await prisma.twoPersonApproval.findUnique({ where: { id: approvalId } });

  try {
    await approveAndExecute(admin, approvalId, async (payload) => {
      const p = payload as { accountId: string };
      const account = await prisma.account.findUnique({ where: { id: p.accountId } });
      if (!account) throw new Error("Account not found.");
      if (account.deletedAt) throw new Error("Already deleted.");

      const now = new Date();
      const updated = await prisma.account.update({
        where: { id: p.accountId },
        data: { deletedAt: now, deletedByAdminId: admin.adminId },
      });

      // Domain-specific record in addition to approveAndExecute's own generic
      // "account.delete.approve_and_execute" log entry — this one carries
      // targetAccountId + before/after so it shows up in this account's own
      // audit trail (accounts/[id]'s "Admin actions taken" section) and in
      // AUD-02's per-account export, not just the approvals audit trail.
      await writeAdminAuditLog(admin, {
        action: "account.delete",
        entityType: "Account",
        entityId: p.accountId,
        targetAccountId: p.accountId,
        reason: approvalRow?.reason ?? undefined,
        beforeData: { deletedAt: null, deletedByAdminId: null },
        afterData: { deletedAt: now, deletedByAdminId: admin.adminId },
      });

      return updated;
    });
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not approve this deletion." };
  }

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: `Deleted. Restorable for ${DELETE_GRACE_WINDOW_DAYS} days.` };
}

export async function rejectAccountDeletion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const approvalId = String(formData.get("approvalId") || "");
  const accountId = String(formData.get("accountId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to reject a deletion request." };

  try {
    await rejectApproval(admin, approvalId, reason);
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not reject this request." };
  }

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Deletion request rejected." };
}

export async function restoreAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to restore an account." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };
  if (!account.deletedAt) return { error: "Not deleted." };

  const ageDays = (Date.now() - account.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > DELETE_GRACE_WINDOW_DAYS) {
    return { error: "Past the 30-day recovery window — no restore is offered (see the account page for why)." };
  }

  await prisma.account.update({
    where: { id: accountId },
    data: { deletedAt: null, deletedByAdminId: null },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.restore",
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
      reason,
      beforeData: { deletedAt: account.deletedAt, deletedByAdminId: account.deletedByAdminId },
      afterData: { deletedAt: null, deletedByAdminId: null },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Account restored." };
}

// --- ACCT-10 region/currency correction -------------------------------------

const VALID_REGIONS = Object.values(Region) as string[];

export async function correctRegion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const newRegion = String(formData.get("region") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!VALID_REGIONS.includes(newRegion)) return { error: "Pick a valid region." };
  if (!reason) return { error: "A reason is required to change an account's region." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };
  if (account.region === newRegion) return { error: "That's already this account's region." };

  await prisma.account.update({ where: { id: accountId }, data: { region: newRegion as Region } });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.region_correction",
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
      reason,
      beforeData: { region: account.region },
      afterData: { region: newRegion },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Region updated." };
}
