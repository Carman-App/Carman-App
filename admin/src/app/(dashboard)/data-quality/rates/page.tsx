import Link from "next/link";
import { requireRole, DATA_QUALITY_ROLES } from "@/lib/auth/rbac";
import { getEditedLateRates, EDITED_RATE_CAVEAT, type RateBucket } from "@/lib/data-quality/rates";
import { parsePeriodDays } from "@/lib/data-quality/period";
import { formatDate } from "@/lib/format";
import { PeriodLinks } from "../_components/period-links";

export const dynamic = "force-dynamic";

function pct(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function RateTable({ title, rows }: { title: string; rows: RateBucket[] }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-neutral-600">{title}</h2>
      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">{title === "By type" ? "Type" : "Region"}</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Total</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Edited rate</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Entered-late rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  No records in this period.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="hover:bg-neutral-100">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-neutral-800">{r.label}</td>
                <td className="whitespace-nowrap px-4 py-2">{r.totalCount.toLocaleString()}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {pct(r.editedRate)} <span className="text-neutral-500">({r.editedCount.toLocaleString()})</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {pct(r.lateRate)} <span className="text-neutral-500">({r.lateCount.toLocaleString()})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireRole(DATA_QUALITY_ROLES);
  const sp = await searchParams;
  const days = parsePeriodDays(sp.days);
  const report = await getEditedLateRates(days);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/data-quality" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Records & data quality
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Edited / entered-late rates</h1>
        <p className="text-sm text-neutral-500">
          Records entered (by <code>createdAt</code>) since {formatDate(report.since)}. Overall:{" "}
          {report.overall.totalCount.toLocaleString()} records, {pct(report.overall.editedRate)} edited,{" "}
          {pct(report.overall.lateRate)} entered late.
        </p>
      </div>

      <PeriodLinks basePath="/data-quality/rates" selected={days} />

      <div className="space-y-2 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800/80">
        <p>
          <strong className="text-amber-800">Edited rate caveat:</strong> {EDITED_RATE_CAVEAT}
        </p>
        <p>
          <strong className="text-amber-800">Entered-late rate:</strong> a record counts as entered
          late when <code>createdAt</code> is more than {report.thresholdDays} days after its own
          effective <code>date</code>. This threshold is fixed and documented in{" "}
          <code>src/lib/data-quality/rates.ts</code>. Unlike the edited rate, this is fully real —
          both fields existed before this pass.
        </p>
      </div>

      <RateTable title="By type" rows={report.byType} />
      <RateTable title="By region" rows={report.byRegion} />
    </div>
  );
}
