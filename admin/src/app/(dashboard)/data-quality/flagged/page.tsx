import Link from "next/link";
import { requireRole, DATA_QUALITY_ROLES } from "@/lib/auth/rbac";
import {
  getFlaggedRecords,
  FLAG_REASON_LABELS,
  AMOUNT_OUTLIER_HIGH_MULTIPLIER,
  AMOUNT_OUTLIER_LOW_DIVISOR,
  AMOUNT_OUTLIER_TRAILING_DAYS,
  FUEL_VOLUME_CEILING_LITRES,
} from "@/lib/data-quality/flagged";
import { RECORD_TYPE_LABELS } from "@/lib/data-quality/record-counts";
import { Badge } from "@/components/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { MaskedMoney } from "@/components/masked-money";

export const dynamic = "force-dynamic";

// PRIV-05 — audit-log entityType per record type, for the reveal action's
// audit trail (see reveal-actions.ts). Matches the Prisma model names.
const RECORD_ENTITY_TYPE: Record<string, string> = {
  fuel: "FuelRecord",
  service: "ServiceRecord",
  repair: "RepairRecord",
  expense: "ExpenseRecord",
  odometer: "OdometerReading",
};

export default async function FlaggedRecordsPage() {
  await requireRole(DATA_QUALITY_ROLES);
  const report = await getFlaggedRecords();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/data-quality" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Records & data quality
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Probably-mistaken records</h1>
        <p className="text-sm text-neutral-500">
          Flagged as questions for a human to look at — nothing here is auto-corrected, and there
          is no fix/edit action on this page or anywhere in this section. Open a row to see the
          full record on its vehicle page.
        </p>
      </div>

      <div className="space-y-1 rounded border border-neutral-200 px-4 py-3 text-xs text-neutral-600">
        <p className="font-medium text-neutral-700">Fixed rules applied (each documented in src/lib/data-quality/flagged.ts):</p>
        <ul className="ml-4 list-disc space-y-0.5">
          <li>Zero amount — fuel/service/repair/expense amount equals 0.</li>
          <li>Future-dated — the record&rsquo;s own date is after right now, for any of the five types.</li>
          <li>
            Amount outlier — amount is more than {AMOUNT_OUTLIER_HIGH_MULTIPLIER}x, or less than
            1/{AMOUNT_OUTLIER_LOW_DIVISOR}x, that type&rsquo;s median amount over the trailing{" "}
            {AMOUNT_OUTLIER_TRAILING_DAYS} days. Median (not mean/stddev) is used because
            financial amounts here are typically right-skewed.
          </li>
          <li>Implausible fuel volume — litres logged over {FUEL_VOLUME_CEILING_LITRES}L, a fixed physical ceiling, not a statistical one.</li>
        </ul>
        <p className="pt-1">
          Trailing-90-day medians used just now — Fuel: {report.medians.fuel != null ? formatMoney(report.medians.fuel) : "n/a"}, Service:{" "}
          {report.medians.service != null ? formatMoney(report.medians.service) : "n/a"}, Repair:{" "}
          {report.medians.repair != null ? formatMoney(report.medians.repair) : "n/a"}, Expense:{" "}
          {report.medians.expense != null ? formatMoney(report.medians.expense) : "n/a"}.
        </p>
      </div>

      <p className="text-sm text-neutral-600">
        {report.flagged.length.toLocaleString()} flagged record{report.flagged.length === 1 ? "" : "s"}
        {report.truncated ? ` (showing the most recent ${report.flagged.length.toLocaleString()} — more exist)` : ""}.
      </p>

      {report.flagged.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          Nothing flagged right now.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Date</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Type</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Amount</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Vehicle</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Account</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Flagged for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {report.flagged.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="hover:bg-neutral-100">
                  <td className="whitespace-nowrap px-4 py-2">{formatDate(r.date)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge value={RECORD_TYPE_LABELS[r.type]} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.amount != null ? (
                      <MaskedMoney
                        value={formatMoney(r.amount)}
                        currency="KES"
                        entityType={RECORD_ENTITY_TYPE[r.type]}
                        entityId={r.id}
                        targetAccountId={r.accountId || null}
                        fieldLabel="flagged amount"
                      />
                    ) : (
                      "—"
                    )}
                    {r.litres != null ? ` · ${r.litres}L` : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link href={`/vehicles/${r.vehicleId}`} className="hover:underline">
                      {r.vehicleLabel}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.accountId ? (
                      <Link href={`/accounts/${r.accountId}`} className="hover:underline">
                        {r.accountName}
                      </Link>
                    ) : (
                      r.accountName
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="inline-flex items-center rounded-full border border-amber-800/60 bg-amber-50 px-2 py-0.5 text-xs text-amber-800"
                          title={FLAG_REASON_LABELS[reason]}
                        >
                          {FLAG_REASON_LABELS[reason]}
                        </span>
                      ))}
                    </div>
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
