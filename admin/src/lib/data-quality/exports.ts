import "server-only";
import { prisma } from "@/lib/prisma";
import { ReportScope, ReportFormat, ReportChannel } from "@/generated/prisma/enums";
import { daysAgo } from "./period";

// DATA-04 — report/export counts. These count *declared* exports (a Report
// row was created, a ReportRecipient row records who/how it was meant to
// reach) — no PDF/CSV renderer or email/WhatsApp provider is connected yet
// (see the comment in src/app/api/v1/reports/route.ts), so none of this
// confirms a file was actually generated or delivered. Every page built on
// this module states that plainly.

export type ScopeCount = { scope: ReportScope; count: number };
export type FormatCount = { format: ReportFormat; count: number };
export type ChannelCount = { channel: ReportChannel; count: number };

export type ExportCountsReport = {
  since: Date;
  totalReports: number;
  byScope: ScopeCount[];
  byFormat: FormatCount[];
  byChannel: ChannelCount[];
  /** DATA-04 — "share of accounts with >=1 report built" in the period. */
  totalAccounts: number;
  accountsWithReport: number;
  accountsWithReportPercent: number | null;
};

export async function getExportCounts(days: number): Promise<ExportCountsReport> {
  const since = daysAgo(days);
  const where = { generatedAt: { gte: since } };

  const [totalReports, byScopeRaw, byFormatRaw, recipients, reportAccountRows, totalAccounts] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.groupBy({ by: ["scope"], where, _count: { _all: true } }),
    prisma.report.groupBy({ by: ["format"], where, _count: { _all: true } }),
    // Recipients don't carry their own date — joined back to their report's
    // generatedAt. Reduced in JS rather than a groupBy-through-relation to
    // keep the query shape simple and unambiguous.
    prisma.reportRecipient.findMany({
      where: { report: { generatedAt: { gte: since } } },
      select: { channel: true },
    }),
    // DATA-04's "share of accounts with >=1 report built" — distinct
    // generatedByAccountId in the period (null when a report was generated
    // without an attributable account, e.g. a system/admin-triggered run).
    prisma.report.findMany({
      where: { ...where, generatedByAccountId: { not: null } },
      select: { generatedByAccountId: true },
      distinct: ["generatedByAccountId"],
    }),
    prisma.account.count({ where: { deletedAt: null } }),
  ]);

  const channelCounts = new Map<ReportChannel, number>();
  for (const r of recipients) {
    channelCounts.set(r.channel, (channelCounts.get(r.channel) ?? 0) + 1);
  }

  const accountsWithReport = reportAccountRows.length;

  return {
    since,
    totalReports,
    byScope: byScopeRaw.map((r) => ({ scope: r.scope, count: r._count._all })).sort((a, b) => b.count - a.count),
    byFormat: byFormatRaw.map((r) => ({ format: r.format, count: r._count._all })).sort((a, b) => b.count - a.count),
    byChannel: [...channelCounts.entries()].map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count),
    totalAccounts,
    accountsWithReport,
    accountsWithReportPercent: totalAccounts === 0 ? null : (accountsWithReport / totalAccounts) * 100,
  };
}
