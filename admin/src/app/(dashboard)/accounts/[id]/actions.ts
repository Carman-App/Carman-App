"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  requireRole,
  ACCOUNT_QUICK_ACTION_ROLES,
  ACCOUNT_DANGEROUS_ACTION_ROLES,
} from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { SuspensionReason, VerificationSource, Region } from "@/generated/prisma/enums";

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

export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to delete an account." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };
  if (account.deletedAt) return { error: "Already deleted." };

  const now = new Date();
  await prisma.account.update({
    where: { id: accountId },
    data: { deletedAt: now, deletedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.delete",
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
      reason,
      beforeData: { deletedAt: null, deletedByAdminId: null },
      afterData: { deletedAt: now, deletedByAdminId: admin.adminId },
    },
  );

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: `Deleted. Restorable for ${DELETE_GRACE_WINDOW_DAYS} days.` };
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
