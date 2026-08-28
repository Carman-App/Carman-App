import Link from "next/link";
import { requireRole, DATA_QUALITY_ROLES } from "@/lib/auth/rbac";
import { getStorageReport, type AccountStorageRow } from "@/lib/data-quality/storage";
import { parsePeriodDays } from "@/lib/data-quality/period";
import { formatDate } from "@/lib/format";
import { PeriodLinks } from "../_components/period-links";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function AccountTable({ title, rows, showBytes }: { title: string; rows: AccountStorageRow[]; showBytes: boolean }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-neutral-600">{title}</h2>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">No documents yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Account</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Documents</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">{showBytes ? "Bytes (known)" : "Bytes"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((r) => (
                <tr key={r.accountId} className="hover:bg-neutral-100">
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link href={`/accounts/${r.accountId}`} className="hover:underline">
                      {r.accountName}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{r.documentCount.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                    {r.bytesKnownCount === 0
                      ? "0 / not yet captured"
                      : `${formatBytes(r.bytesSum)} (${r.bytesKnownCount}/${r.documentCount} docs)`}
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

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireRole(DATA_QUALITY_ROLES);
  const sp = await searchParams;
  const days = parsePeriodDays(sp.days);
  const report = await getStorageReport(days);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/data-quality" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Records & data quality
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Storage per account</h1>
        <p className="text-sm text-neutral-500">
          {report.totalDocuments.toLocaleString()} document{report.totalDocuments === 1 ? "" : "s"} platform-wide
          (active, non-deleted).
          {report.scanTruncated
            ? ` Per-account breakdown below is computed from the most recent ${report.scannedDocumentCount.toLocaleString()} of those.`
            : ""}
        </p>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800/80">
        <strong className="text-amber-800">Byte totals are not real yet.</strong> Document.fileSizeBytes
        is null for essentially every document today — nothing in the mobile app sends a size on
        upload (see the comment on that column in <code>prisma/schema.prisma</code>). Document{" "}
        <em>counts</em> below are fully real and shown prominently; byte figures show as &ldquo;0 /
        not yet captured&rdquo; rather than a misleadingly precise zero, and will only start
        meaning anything once (a) a future mobile change starts sending sizes and (b) enough time
        passes for sized documents to accumulate.
        {report.totalBytesKnownCount === 0
          ? " Right now, zero documents platform-wide have a known size, so the \"heaviest by bytes\" ranking below is skipped entirely — there is nothing real to rank on."
          : ` ${report.totalBytesKnownCount.toLocaleString()} of ${report.totalDocuments.toLocaleString()} documents have a known size so far.`}
      </div>

      <AccountTable title="Heaviest accounts by document count" rows={report.heaviestByCount} showBytes={false} />

      {report.heaviestByBytes ? (
        <AccountTable title="Heaviest accounts by bytes" rows={report.heaviestByBytes} showBytes />
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-600">Heaviest accounts by bytes</h2>
          <p className="rounded border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Not shown — no document anywhere has a captured file size yet, so there is nothing to
            rank. This degrades to the count-based ranking above rather than fabricating a
            bytes-based order.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-600">Platform trend (document count)</h2>
          <PeriodLinks basePath="/data-quality/storage" selected={days} />
        </div>
        <p className="text-xs text-neutral-500">
          Counts-based (bytes aren&rsquo;t real yet — see above). {days} days, split into 8 equal
          buckets.
        </p>
        <div className="flex items-end gap-1.5 rounded border border-neutral-200 p-4">
          {report.trend.map((b, i) => {
            const max = Math.max(1, ...report.trend.map((t) => t.count));
            const heightPct = Math.max(4, (b.count / max) * 100);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-24 w-full items-end">
                  <div className="w-full rounded-t bg-neutral-600" style={{ height: `${heightPct}%` }} title={`${b.count} document(s)`} />
                </div>
                <span className="text-[10px] text-neutral-500">{b.count}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-neutral-500">
          {formatDate(report.trend[0]?.bucketStart)} → {formatDate(report.trend[report.trend.length - 1]?.bucketEnd)}
        </p>
      </div>
    </div>
  );
}
