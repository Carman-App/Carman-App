import { requireRole, GROWTH_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { formatMoney } from "@/lib/format";
import { formatCents } from "@/lib/money/currency";
import { GrowthNav } from "../growth-nav";
import { getGeographyBreakdown } from "@/lib/growth/geography";
import { REPORTING_CURRENCY } from "@/lib/growth/definitions";

export const dynamic = "force-dynamic";

// GROW-07 — geography split. Trailing 30-day window for active/activated
// counts; money figures shown in local currency alongside the
// REPORTING_CURRENCY (USD) conversion via Money's FX table.

export default async function GeographyPage() {
  await requireRole(GROWTH_ROLES);
  const rows = await getGeographyBreakdown(30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Geography split</h1>
        <p className="text-sm text-neutral-500">
          By <code>Account.region</code>. Revenue (Invoice/Payment) has no currency column in the
          schema — it is attributed to a region via the vehicle owner&rsquo;s{" "}
          <code>Account.region</code>, then converted to {REPORTING_CURRENCY} using{" "}
          <code>FxRate</code> (same table and rate source as Billing&rsquo;s &ldquo;Revenue by
          region&rdquo; page — rate source/as-of date shown there). Active/activated counts use a
          trailing 30-day window.
        </p>
      </div>

      <GrowthNav active="/growth/geography" />

      <Section title="By region (trailing 30 days)">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Region</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Currency</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Accounts</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Active</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Activated (ever)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">MRR (gross)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">MRR ({REPORTING_CURRENCY})</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Invoiced (30d, local)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Invoiced ({REPORTING_CURRENCY})</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Collected (30d, local)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Collected ({REPORTING_CURRENCY})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((r) => (
                <tr key={r.region}>
                  <td className="whitespace-nowrap px-4 py-2">{r.label}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.currency}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.accountCount}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.activeAccountCount}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.activatedAccountCount}</td>
                  <td className="whitespace-nowrap px-4 py-2">{formatCents(r.mrrGrossCents, r.currency)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.mrrReportingCents == null
                      ? "No FxRate on file"
                      : formatCents(r.mrrReportingCents, REPORTING_CURRENCY)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{formatMoney(r.invoicedLocal, r.currency)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.invoicedReportingAmount == null
                      ? "No FxRate on file"
                      : formatMoney(r.invoicedReportingAmount, REPORTING_CURRENCY)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{formatMoney(r.collectedLocal, r.currency)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.collectedReportingAmount == null
                      ? "No FxRate on file"
                      : formatMoney(r.collectedReportingAmount, REPORTING_CURRENCY)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
