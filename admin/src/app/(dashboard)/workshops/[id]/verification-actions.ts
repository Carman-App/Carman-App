"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, WORKSHOP_VERIFICATION_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications/provider";
import { WorkshopVerificationAction, NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// WORK-02/03 — grant/revoke a workshop's verified mark. checkedItems is
// stored as JSON ({ notes, documentNote }) rather than structured
// checklist fields — a text-only "what was checked" note, which the spec
// calls an acceptable substitute for a full document-upload flow (see
// src/lib/storage.ts for the S3 abstraction this deliberately doesn't wire
// up here — documentKeys is left empty). Every write keeps
// Workshop.verifiedBadge/verifiedAt in sync with the append-only
// WorkshopVerification history inside one transaction.

export async function grantVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(WORKSHOP_VERIFICATION_ROLES);
  const workshopId = String(formData.get("workshopId") || "");
  const checkedItemsNote = String(formData.get("checkedItemsNote") || "").trim();
  const documentNote = String(formData.get("documentNote") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const effectiveAtRaw = String(formData.get("effectiveAt") || "");

  if (!checkedItemsNote) return { error: "Describe what was checked before granting verification." };

  const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
  if (!workshop) return { error: "Workshop not found." };
  if (workshop.verifiedBadge) return { error: "Already verified." };

  const effectiveAt = effectiveAtRaw ? new Date(effectiveAtRaw) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) return { error: "Invalid effective date." };

  const before = { verifiedBadge: workshop.verifiedBadge, verifiedAt: workshop.verifiedAt };
  const checkedItems: Prisma.InputJsonValue = { notes: checkedItemsNote, documentNote: documentNote || null };

  await prisma.$transaction(async (tx) => {
    await tx.workshopVerification.create({
      data: {
        workshopId,
        action: WorkshopVerificationAction.GRANTED,
        checkedItems,
        documentKeys: [],
        reason: reason || null,
        effectiveAt,
        performedByAdminId: admin.adminId,
      },
    });
    await tx.workshop.update({
      where: { id: workshopId },
      data: { verifiedBadge: true, verifiedAt: effectiveAt },
    });
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "workshop.verification_grant",
      entityType: "Workshop",
      entityId: workshopId,
      reason: reason || checkedItemsNote,
      beforeData: before,
      afterData: { verifiedBadge: true, verifiedAt: effectiveAt.toISOString() },
      metadata: { checkedItemsNote, documentNote: documentNote || null },
    },
  );

  revalidatePath(`/workshops/${workshopId}`);
  return { ok: true, message: "Workshop marked verified." };
}

export async function revokeVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(WORKSHOP_VERIFICATION_ROLES);
  const workshopId = String(formData.get("workshopId") || "");
  const reason = String(formData.get("reason") || "").trim();
  const effectiveAtRaw = String(formData.get("effectiveAt") || "");

  if (!reason) return { error: "A reason is required to revoke a verified mark." };

  const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
  if (!workshop) return { error: "Workshop not found." };
  if (!workshop.verifiedBadge) return { error: "This workshop isn't currently verified." };

  const effectiveAt = effectiveAtRaw ? new Date(effectiveAtRaw) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) return { error: "Invalid effective date." };

  const before = { verifiedBadge: workshop.verifiedBadge, verifiedAt: workshop.verifiedAt };

  await prisma.$transaction(async (tx) => {
    await tx.workshopVerification.create({
      data: {
        workshopId,
        action: WorkshopVerificationAction.REVOKED,
        reason,
        effectiveAt,
        performedByAdminId: admin.adminId,
      },
    });
    await tx.workshop.update({
      where: { id: workshopId },
      data: { verifiedBadge: false, verifiedAt: null },
    });
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "workshop.verification_revoke",
      entityType: "Workshop",
      entityId: workshopId,
      reason,
      beforeData: before,
      afterData: { verifiedBadge: false, verifiedAt: null },
    },
  );

  await notify({
    accountId: workshop.ownerId,
    type: NotificationType.GENERIC,
    title: "Your workshop's verified mark was revoked",
    body: reason,
    metadata: { workshopId, effectiveAt: effectiveAt.toISOString() },
  });

  revalidatePath(`/workshops/${workshopId}`);
  return { ok: true, message: "Verification revoked and the owner notified." };
}
