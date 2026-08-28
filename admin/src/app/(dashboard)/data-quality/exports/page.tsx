import Link from "next/link";
import { requireRole, DATA_QUALITY_ROLES } from "@/lib/auth/rbac";
import { getExportCounts } from "@/lib/data-quality/exports";
import { parsePeriodDays } from "@/lib/data-quality/period";
import { formatDate, titleCase } from "@/lib/format";
import { PeriodLinks } from "../_components/period-links";

export const dynamic = "force-dynamic";

function CountTable({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-neutral-600">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">None in this period.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <tbody className="divide-y divide-neutral-200">
              {rows.map((r) => (
                <tr key={r.label} className="hover:bg-neutral-100">
                  <td className="px-4 py-2 font-medium text-neutral-800">{r.label}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.count.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-500">
                    {total === 0 ? "—" : `${((r.count / total) * 100).toFixed(0)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireRole(DATA_QUALITY_ROLES);
  const sp = await searchParams;
  const days = parsePeriodDays(sp.days);
  const report = await getExportCounts(days);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/data-quality" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Records & data quality
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Report / export counts</h1>
        <p className="text-sm text-neutral-500">
          {report.totalReports.toLocaleString()} report{report.totalReports === 1 ? "" : "s"} generated since{" "}
          {formatDate(report.since)}.
        </p>
      </div>

      <PeriodLinks basePath="/data-quality/exports" selected={days} />

      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800/80">
        These counts are <strong className="text-amber-800">declared intent</strong>, not confirmed
        delivery: no PDF/CSV renderer or email/WhatsApp provider is connected in this codebase yet
        (see the comment in <code>src/app/api/v1/reports/route.ts</code>), so a Report/ReportRecipient
        row records what was requested, not a rendered file or a message that actually left the
        platform.
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <CountTable title="By scope" rows={report.byScope.map((r) => ({ label: titleCase(r.scope), count: r.count }))} />
        <CountTable title="By declared format" rows={report.byFormat.map((r) => ({ label: titleCase(r.format), count: r.count }))} />
        <CountTable title="By declared channel" rows={report.byChannel.map((r) => ({ label: titleCase(r.channel), count: r.count }))} />
      </div>
    </div>
  );
}
