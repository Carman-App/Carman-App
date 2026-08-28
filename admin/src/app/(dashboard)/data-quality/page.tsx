import Link from "next/link";
import { requireRole, DATA_QUALITY_ROLES } from "@/lib/auth/rbac";
import { getRecordCountsByType } from "@/lib/data-quality/record-counts";
import { parsePeriodDays } from "@/lib/data-quality/period";
import { formatDate } from "@/lib/format";
import { PeriodLinks } from "./_components/period-links";

export const dynamic = "force-dynamic";

const SUBPAGES = [
  { href: "/data-quality/rates", label: "Edited / entered-late rates (DATA-02)" },
  { href: "/data-quality/flagged", label: "Probably-mistaken records (DATA-03)" },
  { href: "/data-quality/exports", label: "Report / export counts (DATA-04)" },
  { href: "/data-quality/storage", label: "Storage per account (DATA-05)" },
  { href: "/data-quality/sync-errors", label: "Sync errors (DATA-06)" },
];

function TrendBadge({ percent }: { percent: number | null }) {
  if (percent == null) {
    return <span className="text-neutral-500">no prior-period baseline</span>;
  }
  const rounded = Math.abs(percent) < 0.1 ? 0 : percent;
  if (rounded > 0) return <span className="text-emerald-600">▲ +{rounded.toFixed(0)}%</span>;
  if (rounded < 0) return <span className="text-red-600">▼ {rounded.toFixed(0)}%</span>;
  return <span className="text-neutral-500">▬ flat</span>;
}

export default async function DataQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireRole(DATA_QUALITY_ROLES);
  const sp = await searchParams;
  const days = parsePeriodDays(sp.days);
  const report = await getRecordCountsByType(days);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Records & data quality</h1>
        <p className="text-sm text-neutral-500">
          DATA-01: record counts by type — fuel, service, repair, expense, and odometer, exactly
          the five record tables in the schema. Counted by <code>createdAt</code> (when entered),
          for {formatDate(report.period.start)}–{formatDate(report.period.end)}, vs. the prior
          period of equal length ({formatDate(report.priorPeriod.start)}–
          {formatDate(report.priorPeriod.end)}). &ldquo;Distinct accounts&rdquo; counts a garage
          owner once per vehicle they own, plus every account with a membership on that vehicle.
        </p>
      </div>

      <PeriodLinks basePath="/data-quality" selected={days} />

      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Type</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Count</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Distinct accounts</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Share of total</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Prior period</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {report.stats.map((s) => (
              <tr key={s.type} className="hover:bg-neutral-100">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-neutral-800">{s.label}</td>
                <td className="whitespace-nowrap px-4 py-2">{s.count.toLocaleString()}</td>
                <td className="whitespace-nowrap px-4 py-2">{s.distinctAccounts.toLocaleString()}</td>
                <td className="whitespace-nowrap px-4 py-2">{(s.shareOfTotal * 100).toFixed(1)}%</td>
                <td className="whitespace-nowrap px-4 py-2 text-neutral-600">{s.priorCount.toLocaleString()}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <TrendBadge percent={s.trendPercent} />
                </td>
              </tr>
            ))}
            <tr className="bg-neutral-50 font-medium text-neutral-800">
              <td className="whitespace-nowrap px-4 py-2">Total</td>
              <td className="whitespace-nowrap px-4 py-2">{report.totalCount.toLocaleString()}</td>
              <td className="whitespace-nowrap px-4 py-2 text-neutral-500" colSpan={4}>
                —
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500">
        Related: vehicle-level odometer rollback/jump/duplicate detection lives at{" "}
        <Link href="/vehicles/odometer-flags" className="hover:underline">
          Vehicles → Odometer flags
        </Link>{" "}
        — a different, Phase Two check, not part of DATA-03 below.
      </p>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-600">More data-quality views</h2>
        <div className="flex flex-wrap gap-2">
          {SUBPAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
            >
              {p.label} →
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
