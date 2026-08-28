import "server-only";
import { prisma } from "@/lib/prisma";
import { SignupSource, SubscriptionStatus } from "@/generated/prisma/enums";
import { getActivatedAccountIds } from "./definitions";

// GROW-02 — Account.signupSource broken down through activation (Activated
// account definition, definitions.ts) and paid conversion (has an
// ACTIVE/PAST_DUE Subscription). Every account created before this field
// existed — and any signup path that doesn't pass a source — reads UNKNOWN
// by schema default; there is no historical backfill possible for those
// rows, since nothing recorded how they actually arrived.

export type SignupSourceRow = {
  source: SignupSource;
  total: number;
  activated: number;
  activatedPercent: number | null;
  paid: number;
  paidPercent: number | null;
};

export async function getSignupSourceBreakdown(): Promise<SignupSourceRow[]> {
  const [accounts, activatedIds, paidAccountRows] = await Promise.all([
    prisma.account.findMany({ where: { deletedAt: null }, select: { id: true, signupSource: true } }),
    getActivatedAccountIds(),
    prisma.subscription.findMany({
      where: { accountId: { not: null }, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] } },
      select: { accountId: true },
    }),
  ]);
  const paidIds = new Set(paidAccountRows.map((s) => s.accountId as string));

  const bySource = new Map<SignupSource, { total: number; activated: number; paid: number }>();
  for (const source of Object.values(SignupSource)) bySource.set(source, { total: 0, activated: 0, paid: 0 });

  for (const account of accounts) {
    const bucket = bySource.get(account.signupSource)!;
    bucket.total += 1;
    if (activatedIds.has(account.id)) bucket.activated += 1;
    if (paidIds.has(account.id)) bucket.paid += 1;
  }

  return [...bySource.entries()].map(([source, b]) => ({
    source,
    total: b.total,
    activated: b.activated,
    activatedPercent: b.total === 0 ? null : (b.activated / b.total) * 100,
    paid: b.paid,
    paidPercent: b.total === 0 ? null : (b.paid / b.total) * 100,
  }));
}
