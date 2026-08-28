import "server-only";
import { prisma } from "@/lib/prisma";
import { Region } from "@/generated/prisma/enums";
import { fetchRecords, isoWeekKey, trailingWindow } from "./definitions";

// GROW-08 — rank accounts by (records logged + distinct weeks active) in a
// trailing window, with contact-permission state and the chasedEngagementAt
// "never chase twice" marker.
//
// Contact permission: neither Account nor Notification has an opt-in/
// consent-style field. A real, purpose-built model does exist —
// PrivacyConsent (accountId/purpose/granted) — but its own schema comment
// states `source` is "always empty in practice until [mobile onboarding
// capture] is built", i.e. it's real infrastructure with no real rows
// written yet for virtually every account, the same gap PRIV-03 documents
// elsewhere in this build. Rather than assume "no consent = no rows" is
// itself meaningful, this queries PrivacyConsent(purpose="marketing") for
// each shortlisted account and reports "not captured" only when it's
// genuinely absent — so if/when real consent rows start appearing, this
// list picks them up automatically without code changes.

export type ContactPermission = "granted" | "declined" | "not_captured";

export type EngagementRow = {
  accountId: string;
  name: string;
  email: string;
  region: Region;
  recordCount: number;
  distinctWeeksActive: number;
  score: number; // recordCount + distinctWeeksActive
  contactPermission: ContactPermission;
  chasedEngagementAt: Date | null;
};

export async function getEngagementShortlist(windowDays = 90, limit = 200): Promise<EngagementRow[]> {
  const range = trailingWindow(windowDays);
  const records = await fetchRecords(range);

  const byAccount = new Map<string, { count: number; weeks: Set<string> }>();
  for (const r of records) {
    if (!r.accountId) continue;
    let bucket = byAccount.get(r.accountId);
    if (!bucket) {
      bucket = { count: 0, weeks: new Set() };
      byAccount.set(r.accountId, bucket);
    }
    bucket.count += 1;
    bucket.weeks.add(isoWeekKey(r.createdAt));
  }

  const accountIds = [...byAccount.keys()];
  if (accountIds.length === 0) return [];

  const [accounts, consents] = await Promise.all([
    prisma.account.findMany({
      where: { id: { in: accountIds }, deletedAt: null },
      select: { id: true, region: true, chasedEngagementAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.privacyConsent.findMany({
      where: { accountId: { in: accountIds }, purpose: "marketing" },
      orderBy: { capturedAt: "desc" },
      select: { accountId: true, granted: true },
    }),
  ]);

  // Most recent consent wins — findMany above is ordered desc by capturedAt.
  const consentByAccount = new Map<string, boolean>();
  for (const c of consents) {
    if (!consentByAccount.has(c.accountId)) consentByAccount.set(c.accountId, c.granted);
  }

  const rows: EngagementRow[] = accounts.map((a) => {
    const bucket = byAccount.get(a.id)!;
    const contactPermission: ContactPermission = consentByAccount.has(a.id)
      ? consentByAccount.get(a.id)
        ? "granted"
        : "declined"
      : "not_captured";
    return {
      accountId: a.id,
      name: a.user.name,
      email: a.user.email,
      region: a.region,
      recordCount: bucket.count,
      distinctWeeksActive: bucket.weeks.size,
      score: bucket.count + bucket.weeks.size,
      contactPermission,
      chasedEngagementAt: a.chasedEngagementAt,
    };
  });

  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}
