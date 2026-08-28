import { prisma } from "@/lib/prisma";
import { CampaignChannel, MessageClass } from "@/generated/prisma/enums";

/**
 * COMM-03 — a MessageSuppression row applies to a given (channel,
 * messageClass) pair when its own `channel` is null OR equals the given
 * channel, AND its `messageClass` is null OR equals the given class. null on
 * either field means "all channels" / "all classes" for that row. The most
 * recently created matching row is treated as authoritative when more than
 * one applies (there's no real conflict case today — ADMIN_SET is the only
 * producer — but this keeps behaviour well-defined if that changes).
 *
 * Real user-initiated opt-outs (USER_OPTED_OUT / BOUNCED) have no producer
 * anywhere in this codebase yet — nothing writes those reasons today. Only
 * the admin-facing "add suppression" form (ADMIN_SET) is wired up, so the
 * mechanism is exercisable/testable ahead of a real opt-out flow existing.
 */
export async function isSuppressed(
  accountId: string,
  channel: CampaignChannel,
  messageClass: MessageClass,
): Promise<{ suppressed: boolean; reason?: string }> {
  const row = await prisma.messageSuppression.findFirst({
    where: {
      accountId,
      AND: [{ OR: [{ channel: null }, { channel }] }, { OR: [{ messageClass: null }, { messageClass }] }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { suppressed: false };
  return {
    suppressed: true,
    reason: `${row.reason} (${row.channel ?? "all channels"} / ${row.messageClass ?? "all classes"})`,
  };
}

/**
 * Bulk variant for evaluating a whole campaign send in one query instead of
 * one round-trip per account. Returns a Map of accountId -> reason string
 * for every account in `accountIds` that has a matching suppression row.
 */
export async function getSuppressionMap(
  accountIds: string[],
  channel: CampaignChannel,
  messageClass: MessageClass,
): Promise<Map<string, string>> {
  if (accountIds.length === 0) return new Map();
  const rows = await prisma.messageSuppression.findMany({
    where: {
      accountId: { in: accountIds },
      AND: [{ OR: [{ channel: null }, { channel }] }, { OR: [{ messageClass: null }, { messageClass }] }],
    },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    // Later rows (created after) win, matching isSuppressed()'s "most recent wins".
    map.set(row.accountId, `${row.reason} (${row.channel ?? "all channels"} / ${row.messageClass ?? "all classes"})`);
  }
  return map;
}
