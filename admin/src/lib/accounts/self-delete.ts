import "server-only";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

/**
 * Account deletion requested by the person in the app (App Store 5.1.1(v),
 * Google Play account deletion policy).
 *
 * At once: the account is marked deleted, every session ends, and the API
 * refuses it (requireAccount). After SELF_DELETE_GRACE_DAYS the worker's
 * daily purge removes the person and everything that belongs to them
 * (garages they own, vehicles, records, documents, workshops they own ...)
 * via the schema's cascades. The grace window lets support restore a
 * deletion made by mistake (ACCT-07).
 *
 * Deletions made by an admin are separate (deletedByAdminId is set) and are
 * not purged here; see the console's account page.
 */

export const SELF_DELETE_GRACE_DAYS = 30;

export async function deleteOwnAccount(accountId: string, ipAddress: string | null): Promise<{ purgeAfter: Date }> {
  const now = new Date();
  await prisma.$transaction([
    prisma.account.update({ where: { id: accountId }, data: { deletedAt: now, deletedByAdminId: null } }),
    prisma.endUserRefreshToken.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: now, revokedReason: "account_deleted" } }),
  ]);
  await writeAuditLog({
    actorId: accountId,
    action: "account.self_delete",
    entityType: "Account",
    entityId: accountId,
    targetAccountId: accountId,
    ipAddress,
    afterData: { deletedAt: now, purgeAfterDays: SELF_DELETE_GRACE_DAYS },
  });
  return { purgeAfter: new Date(now.getTime() + SELF_DELETE_GRACE_DAYS * 86_400_000) };
}

/** Permanently removes self-deleted accounts past the grace window. Returns how many. */
export async function purgeSelfDeletedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - SELF_DELETE_GRACE_DAYS * 86_400_000);
  const due = await prisma.account.findMany({
    where: { deletedAt: { lt: cutoff }, deletedByAdminId: null },
    select: { id: true, userId: true },
    take: 500,
  });
  let purged = 0;
  for (const a of due) {
    // Deleting the User cascades to the Account and everything it owns.
    await prisma.user.delete({ where: { id: a.userId } });
    await prisma.auditLog.create({
      data: { actorType: "ACCOUNT", actorId: null, action: "account.purged", entityType: "Account", entityId: a.id, targetAccountId: null, metadata: { reason: `self-deleted more than ${SELF_DELETE_GRACE_DAYS} days ago` } },
    });
    purged += 1;
  }
  return purged;
}
