"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CONSENT_SESSION_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { ConsentMethod, ConsentSessionStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const SESSION_LENGTH_MS = 60 * 60 * 1000; // 1 hour time-box, per AGENTS.md SUP-03

// SUP-03 scaffolding ONLY. See prisma/schema.prisma's ConsentSession comment
// and the disclaimer rendered on every page in this folder: nothing here
// grants any admin tool read access to a real account's live app data.
// MOBILE_PUSH_REQUEST has no handshake to trigger yet — every session
// created through this form is ASSERTED (consent obtained some other way,
// e.g. a phone call, and logged as such).

export async function requestConsentSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONSENT_SESSION_ROLES);
  const accountId = String(formData.get("accountId") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  if (!accountId) return { error: "An account id is required." };
  if (!notes) return { error: "Notes are required — state how/why consent will be sought." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "No account with that id." };

  const session = await prisma.consentSession.create({
    data: {
      accountId,
      requestedByAdminId: admin.adminId,
      consentMethod: ConsentMethod.ASSERTED,
      status: ConsentSessionStatus.REQUESTED,
      notes,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.consent_session_requested",
      entityType: "ConsentSession",
      entityId: session.id,
      targetAccountId: accountId,
      reason: notes,
    },
  );

  revalidatePath("/support/consent");
  return { ok: true, message: "Consent session requested (logged, not yet active)." };
}

export async function grantConsentSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONSENT_SESSION_ROLES);
  const sessionId = String(formData.get("sessionId") || "");
  const grantNote = String(formData.get("grantNote") || "").trim();
  if (!grantNote) return { error: "Describe how consent was actually obtained (e.g. a phone call)." };

  const session = await prisma.consentSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "Session not found." };
  if (session.status !== ConsentSessionStatus.REQUESTED) return { error: "Only a requested session can be granted." };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LENGTH_MS);

  await prisma.consentSession.update({
    where: { id: sessionId },
    data: {
      status: ConsentSessionStatus.ACTIVE,
      consentGrantedAt: now,
      startedAt: now,
      expiresAt,
      notes: session.notes ? `${session.notes}\n\nGranted: ${grantNote}` : `Granted: ${grantNote}`,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.consent_session_granted",
      entityType: "ConsentSession",
      entityId: sessionId,
      targetAccountId: session.accountId,
      reason: grantNote,
      afterData: { expiresAt },
    },
  );

  revalidatePath("/support/consent");
  return { ok: true, message: "Marked granted. Time-boxed to one hour from now." };
}

export async function denyConsentSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONSENT_SESSION_ROLES);
  const sessionId = String(formData.get("sessionId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to record a denial." };

  const session = await prisma.consentSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "Session not found." };

  await prisma.consentSession.update({
    where: { id: sessionId },
    data: { status: ConsentSessionStatus.DENIED, notes: session.notes ? `${session.notes}\n\nDenied: ${reason}` : `Denied: ${reason}` },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.consent_session_denied",
      entityType: "ConsentSession",
      entityId: sessionId,
      targetAccountId: session.accountId,
      reason,
    },
  );

  revalidatePath("/support/consent");
  return { ok: true, message: "Recorded as denied." };
}

export async function endConsentSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONSENT_SESSION_ROLES);
  const sessionId = String(formData.get("sessionId") || "");

  const session = await prisma.consentSession.findUnique({ where: { id: sessionId } });
  if (!session) return { error: "Session not found." };

  await prisma.consentSession.update({
    where: { id: sessionId },
    data: { status: ConsentSessionStatus.ENDED, endedAt: new Date() },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.consent_session_ended",
      entityType: "ConsentSession",
      entityId: sessionId,
      targetAccountId: session.accountId,
    },
  );

  revalidatePath("/support/consent");
  return { ok: true, message: "Session ended." };
}

/**
 * On-page freshness check: flips any ACTIVE session whose time-box has
 * passed to EXPIRED. No cron/background job exists for this — it's run
 * synchronously whenever the consent list page is loaded, which is
 * sufficient since nothing else in the codebase reads consentSession.status.
 */
export async function syncExpiredConsentSessions(): Promise<void> {
  await prisma.consentSession.updateMany({
    where: { status: ConsentSessionStatus.ACTIVE, expiresAt: { lt: new Date() } },
    data: { status: ConsentSessionStatus.EXPIRED },
  });
}
