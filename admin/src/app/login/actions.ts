"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  createPending2fa,
  getPending2fa,
  clearPending2fa,
} from "@/lib/auth/session";
import {
  generateTotpSecret,
  generateSetupQrCode,
  verifyTotpCode,
  generateBackupCodes,
  consumeBackupCode,
} from "@/lib/auth/twofactor";
import { writeAuditLog } from "@/lib/audit";
import { AuditActorType } from "@/generated/prisma/enums";

export type LoginState = {
  error?: string;
} | undefined;

function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * Step 1: email + password. Never creates a real session directly — 2FA is
 * required for every admin (AUD-05), so this always hands off to either the
 * code-verification step (already enrolled) or the mandatory enrollment
 * step (not yet enrolled — there is no way to reach the dashboard without
 * setting it up).
 */
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = safeNext(String(formData.get("next") || "/"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || admin.disabledAt) {
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  await createPending2fa({ id: admin.id, email: admin.email });

  const qs = `?next=${encodeURIComponent(next)}`;
  if (admin.twoFactorEnabled) {
    redirect(`/login/verify${qs}`);
  }
  redirect(`/login/setup-2fa${qs}`);
}

export type VerifyState = { error?: string } | undefined;

/** Step 2 (already enrolled): a 6-digit TOTP code, or a backup code. */
export async function verifyTwoFactor(
  _prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const code = String(formData.get("code") || "").trim();
  const next = safeNext(String(formData.get("next") || "/"));
  const isBackup = String(formData.get("mode") || "") === "backup";

  const pending = await getPending2fa();
  if (!pending) {
    redirect("/login");
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin || admin.disabledAt || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
    redirect("/login");
  }

  if (isBackup) {
    const remaining = await consumeBackupCode(code, admin.twoFactorBackupCodes);
    if (!remaining) {
      return { error: "That backup code is invalid or already used." };
    }
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { twoFactorBackupCodes: remaining },
    });
  } else if (!verifyTotpCode(admin.email, admin.twoFactorSecret, code)) {
    return { error: "That code is invalid or expired." };
  }

  await clearPending2fa();
  await createSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  await writeAuditLog({
    actorId: admin.id,
    actorType: AuditActorType.ADMIN,
    action: "admin.sign_in",
    entityType: "AdminUser",
    entityId: admin.id,
    metadata: { method: isBackup ? "backup_code" : "totp" },
  });
  redirect(next);
}

export type SetupState =
  | { error?: string; secret?: string; qrDataUrl?: string; backupCodes?: string[] }
  | undefined;

/**
 * Step 2 (not yet enrolled): mandatory 2FA setup. Generates+persists a
 * secret (enabled=false until confirmed) and renders it as a QR + manual
 * entry. There is deliberately no "skip" — AUD-05 requires 2FA for every
 * admin, and there is no legacy admin this would strand: create-admin.ts
 * (the only way to make an AdminUser) always yields one that must enroll
 * on first sign-in.
 */
export async function startTwoFactorSetup(): Promise<SetupState> {
  const pending = await getPending2fa();
  if (!pending) redirect("/login");

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin || admin.disabledAt) redirect("/login");
  if (admin.twoFactorEnabled) redirect(`/login/verify`);

  const secret = admin.twoFactorSecret ?? generateTotpSecret();
  if (!admin.twoFactorSecret) {
    await prisma.adminUser.update({ where: { id: admin.id }, data: { twoFactorSecret: secret } });
  }
  const qrDataUrl = await generateSetupQrCode(admin.email, secret);
  return { secret, qrDataUrl };
}

export async function confirmTwoFactorSetup(
  _prevState: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const code = String(formData.get("code") || "").trim();

  const pending = await getPending2fa();
  if (!pending) redirect("/login");

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin || admin.disabledAt || !admin.twoFactorSecret) redirect("/login");

  if (!verifyTotpCode(admin.email, admin.twoFactorSecret, code)) {
    const qrDataUrl = await generateSetupQrCode(admin.email, admin.twoFactorSecret);
    return { error: "That code didn't match. Scan the QR again and try the newest code.", secret: admin.twoFactorSecret, qrDataUrl };
  }

  const { plain, hashed } = await generateBackupCodes();
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: hashed },
  });

  await writeAuditLog({
    actorId: admin.id,
    actorType: AuditActorType.ADMIN,
    action: "admin.two_factor_enrolled",
    entityType: "AdminUser",
    entityId: admin.id,
  });

  // Backup codes are shown exactly once, right now, via the confirmation
  // page's state — the session isn't created until they acknowledge them
  // (see the "finish" action below), keeping this step interruption-safe.
  return { backupCodes: plain, secret: admin.twoFactorSecret };
}

/** Form-action-friendly wrapper around finishTwoFactorSetup for the "I've saved my backup codes" button. */
export async function finishTwoFactorSetupAction(formData: FormData): Promise<void> {
  await finishTwoFactorSetup(String(formData.get("next") || "/"));
}

export async function finishTwoFactorSetup(next: string): Promise<void> {
  const pending = await getPending2fa();
  if (!pending) redirect("/login");
  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin || !admin.twoFactorEnabled) redirect("/login");

  await clearPending2fa();
  await createSession({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  await writeAuditLog({
    actorId: admin.id,
    actorType: AuditActorType.ADMIN,
    action: "admin.sign_in",
    entityType: "AdminUser",
    entityId: admin.id,
    metadata: { method: "totp", firstSignInAfterEnrollment: true },
  });
  redirect(safeNext(next));
}
