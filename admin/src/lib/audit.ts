import { prisma } from "@/lib/prisma";
import { AuditActorType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { getRequestIp } from "@/lib/auth/session";
import type { CurrentSession } from "@/lib/auth/session";

export type AuditEntry = {
  actorId?: string | null;
  actorType?: AuditActorType;
  action: string;
  entityType: string;
  entityId: string;
  /** Denormalized account this action is "about", for AUD-02's per-account export/filter — set whenever the entity belongs to (or is) an Account. */
  targetAccountId?: string | null;
  /** Required by convention (not enforced in the type) for anything ACCT-05/06/07/08/10-shaped — the admin's stated reason for a dangerous or personal-data-touching action. */
  reason?: string | null;
  ipAddress?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

/**
 * Central place to write audit log rows. Call this for invitations, role
 * changes, vehicle changes, record soft-deletes, document access, workshop
 * access grant/revoke, estimate approve/decline, invoice creation, payment
 * recording, report generation, and every admin-console write — anything a
 * future "who did this" question needs an answer to.
 *
 * The table is append-only (AUD-01): no function here or elsewhere issues
 * an UPDATE/DELETE against audit_logs, and the database enforces the same
 * rule independently via a trigger (see the admin_rbac_2fa_audit_accounts
 * migration) — so this module intentionally never exports one.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      actorType: entry.actorType ?? AuditActorType.ACCOUNT,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      targetAccountId: entry.targetAccountId ?? null,
      reason: entry.reason ?? null,
      ipAddress: entry.ipAddress ?? null,
      beforeData: (entry.beforeData as Prisma.InputJsonValue) ?? undefined,
      afterData: (entry.afterData as Prisma.InputJsonValue) ?? undefined,
      metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

/**
 * Convenience wrapper for admin-console writes: fills in actorType=ADMIN,
 * the signed-in admin's id, and the caller's IP automatically, so every
 * call site in src/app/(dashboard)/** only has to state what happened.
 */
export async function writeAdminAuditLog(
  admin: Pick<CurrentSession, "adminId">,
  entry: Omit<AuditEntry, "actorId" | "actorType" | "ipAddress">,
): Promise<void> {
  const ipAddress = await getRequestIp();
  await writeAuditLog({
    ...entry,
    actorId: admin.adminId,
    actorType: AuditActorType.ADMIN,
    ipAddress,
  });
}
