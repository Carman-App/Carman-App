import { prisma } from "@/lib/prisma";
import { MessageClass, CampaignRecipientState } from "@/generated/prisma/enums";

/**
 * COMM-02 "frequency cap enforced across all campaigns" — documented, fixed
 * policy (no config UI for this; change the constants below to retune it):
 *
 *   At most FREQUENCY_CAP_MAX MARKETING or PRODUCT_UPDATE campaign sends per
 *   account within a rolling FREQUENCY_CAP_WINDOW_DAYS-day window, counted
 *   across ALL campaigns (not just the one currently being sent).
 *
 *   TRANSACTIONAL messages (service due, invoices, payments, etc.) are
 *   exempt from the cap entirely — they're not marketing, and a workshop's
 *   customer needs to reliably receive them.
 *
 * Only CampaignRecipient rows with deliveryState SENT or QUEUED count toward
 * the cap — a row that ended up SUPPRESSED/NO_PROVIDER/FAILED never actually
 * reached the account, so it shouldn't count against a future send.
 */
export const FREQUENCY_CAP_MAX = 3;
export const FREQUENCY_CAP_WINDOW_DAYS = 7;
const CAPPED_CLASSES: MessageClass[] = [MessageClass.MARKETING, MessageClass.PRODUCT_UPDATE];
const COUNTED_STATES: CampaignRecipientState[] = [CampaignRecipientState.SENT, CampaignRecipientState.QUEUED];

export function isCappedClass(messageClass: MessageClass): boolean {
  return CAPPED_CLASSES.includes(messageClass);
}

export async function isOverFrequencyCap(accountId: string, messageClass: MessageClass): Promise<boolean> {
  if (!isCappedClass(messageClass)) return false;
  const windowStart = new Date(Date.now() - FREQUENCY_CAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const count = await prisma.campaignRecipient.count({
    where: {
      accountId,
      createdAt: { gte: windowStart },
      deliveryState: { in: COUNTED_STATES },
      campaign: { messageClass: { in: CAPPED_CLASSES } },
    },
  });
  return count >= FREQUENCY_CAP_MAX;
}

/**
 * Bulk variant for a whole campaign send: returns the subset of
 * `accountIds` that are already at or over the cap. Exempts everything
 * immediately (empty set) when `messageClass` isn't a capped class.
 */
export async function getOverCapAccountIds(
  accountIds: string[],
  messageClass: MessageClass,
): Promise<Set<string>> {
  if (!isCappedClass(messageClass) || accountIds.length === 0) return new Set();
  const windowStart = new Date(Date.now() - FREQUENCY_CAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.campaignRecipient.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accountIds },
      createdAt: { gte: windowStart },
      deliveryState: { in: COUNTED_STATES },
      campaign: { messageClass: { in: CAPPED_CLASSES } },
    },
    _count: { _all: true },
  });
  return new Set(rows.filter((r) => r._count._all >= FREQUENCY_CAP_MAX).map((r) => r.accountId));
}
