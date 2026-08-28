"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, TRUST_DANGEROUS_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { RestrictionCapability } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const CAPABILITIES = Object.values(RestrictionCapability) as string[];

// TRUST-03 — restrict one capability instead of the whole account. Active
// iff endAt > now() and liftedAt is null — computed at read time, no cron.

export async function createRestriction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_DANGEROUS_ROLES);
  const accountId = String(formData.get("accountId") || "").trim();
  const capability = String(formData.get("capability") || "");
  const reason = String(formData.get("reason") || "").trim();
  const durationDays = Number(formData.get("durationDays") || "0");

  if (!accountId) return { error: "An account id is required." };
  if (!CAPABILITIES.includes(capability)) return { error: "Pick a capability." };
  if (!reason) return { error: "A reason is required." };
  if (!Number.isFinite(durationDays) || durationDays <= 0) return { error: "Pick a duration greater than zero days." };

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "No account with that id." };

  const now = new Date();
  const endAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const restriction = await prisma.capabilityRestriction.create({
    data: {
      accountId,
      capability: capability as RestrictionCapability,
      reason,
      startAt: now,
      endAt,
      createdByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.capability_restriction_create",
      entityType: "CapabilityRestriction",
      entityId: restriction.id,
      targetAccountId: accountId,
      reason,
      afterData: { capability, endAt },
    },
  );

  revalidatePath("/trust/restrictions");
  return { ok: true, message: `Restricted ${capability} until ${endAt.toISOString()}.` };
}

export async function liftRestriction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_DANGEROUS_ROLES);
  const restrictionId = String(formData.get("restrictionId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to lift a restriction early." };

  const restriction = await prisma.capabilityRestriction.findUnique({ where: { id: restrictionId } });
  if (!restriction) return { error: "Restriction not found." };
  if (restriction.liftedAt) return { error: "Already lifted." };

  await prisma.capabilityRestriction.update({
    where: { id: restrictionId },
    data: { liftedAt: new Date(), liftedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.capability_restriction_lift",
      entityType: "CapabilityRestriction",
      entityId: restrictionId,
      targetAccountId: restriction.accountId,
      reason,
    },
  );

  revalidatePath("/trust/restrictions");
  return { ok: true, message: "Lifted." };
}
