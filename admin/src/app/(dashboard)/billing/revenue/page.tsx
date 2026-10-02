import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { formatDate } from "@/lib/format";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { REGION_LABELS, currencyForRegion } from "@/lib/region";
import type { Region } from "@/generated/prisma/enums";
import { ensureFxRatesSeeded, getFxRateMap, convertCentsToReportingCurrency } from "@/lib/money/fx";
import { formatCents, REPORTING_CURRENCY } from "@/lib/money/currency";

export const dynamic = "force-dynamic";

// MON-09 — "revenue by country/currency with conversion basis stated (local
// currency as charged, converted to one reporting currency, rate source+date
// printed beside the figure)."
//
// AGENTS.md scalability pass, section 17: this used to load every
// ACTIVE/PAST_DUE Subscription row platform-wide (with plan + account +
// workshop-owner joins) and group/sum them in JS — an unbounded scan that
// grows with total subscriber count. The grouping and summing now happen in
// one grouped SQL query (GROUP BY region), so this page's cost scales with
// the number of distinct regions (a handful), not the number of
// subscriptions. The region-resolution logic (account's region, or its
// workshop owner's region when the subscription is workshop-side) and the
// price figure (Plan.priceCents) are unchanged from the original — this is
// a query-strategy change, not a behavior change.
type RegionRevenueRow = { region: Region; gross_cents: string; cnt: string };

async function getRevenueByRegion(): Promise<{ region: Region; grossCents: number; count: number }[]> {
  const rows = await prisma.$queryRaw<RegionRevenueRow[]>`
    SELECT
      COALESCE(a.region, ow.region) AS region,
      SUM(p."priceCents")::text AS gross_cents,
      COUNT(*)::text AS cnt
    FROM subscriptions s
    JOIN plans p ON p.id = s."planId"
    LEFT JOIN accounts a ON a.id = s."accountId"
    LEFT JOIN workshops w ON w.id = s."workshopId"
    LEFT JOIN accounts ow ON ow.id = w."ownerId"
    WHERE s.status IN ('ACTIVE', 'PAST_DUE')
      AND COALESCE(a.region, ow.region) IS NOT NULL
    GROUP BY COALESCE(a.region, ow.region)
  `;
  return rows.map((r) => ({ region: r.region, grossCents: Number(r.gross_cents), count: Number(r.cnt) }));
}

export default async function RevenuePage() {
  await requireRole(BILLING_ROLES);
  await ensureFxRatesSeeded();

  const byRegion = await getRevenueByRegion();
  const rates = await getFxRateMap();

  const rows = byRegion
    .map((r) => {
      const currency = currencyForRegion(r.region);
      const rate = rates.get(currency);
      const convertedCents = convertCentsToReportingCurrency(r.grossCents, currency, rates);
      return { ...r, currency, convertedCents, rate };
    })
    .sort((a, b) => (b.convertedCents ?? 0) - (a.convertedCents ?? 0));

  const totalConverted = rows.reduce((sum, r) => sum + (r.convertedCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Revenue by region</h1>
        <p className="text-sm text-neutral-500">
          Local currency is derived the same way ACCT-10 does everywhere else — from each
          account&rsquo;s (or workshop owner&rsquo;s) <code>region</code>. Every converted figure
          states its conversion basis (reporting currency: <strong>{REPORTING_CURRENCY}</strong>) plus
          the exact rate, source, and as-of date used, printed beside it — never converted silently.
        </p>
      </div>

      <BillingNav active="/billing/revenue" />

      <Section title="By region (ACTIVE + PAST_DUE subscriptions only)">
        {rows.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
            No billed subscriptions on file.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Region</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Currency (as charged)</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Subscriptions</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Gross</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Converted ({REPORTING_CURRENCY})</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Conversion basis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rows.map((r) => (
                  <tr key={r.region}>
                    <td className="whitespace-nowrap px-4 py-2">{REGION_LABELS[r.region]} ({r.region})</td>
                    <td className="whitespace-nowrap px-4 py-2">{r.currency}</td>
                    <td className="whitespace-nowrap px-4 py-2">{r.count}</td>
                    <td className="whitespace-nowrap px-4 py-2">{formatCents(r.grossCents, r.currency)}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {r.convertedCents == null ? (
                        <span className="text-amber-600">No FxRate on file</span>
                      ) : (
                        formatCents(r.convertedCents, REPORTING_CURRENCY)
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-neutral-500">
                      {r.currency === REPORTING_CURRENCY
                        ? "Already in reporting currency — no conversion applied."
                        : r.rate
                          ? `1 ${r.currency} = ${r.rate.rateToReportingCurrency.toFixed(6)} ${REPORTING_CURRENCY} — ${r.rate.source}, as of ${formatDate(r.rate.asOfDate)}`
                          : "No rate on file."}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-50 font-medium">
                  <td className="whitespace-nowrap px-4 py-2" colSpan={4}>
                    Total (converted)
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{formatCents(totalConverted, REPORTING_CURRENCY)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="FX rate table on file">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Currency</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Rate to {REPORTING_CURRENCY}</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Source</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">As of</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {[...rates.values()].map((r) => (
                <tr key={r.currency}>
                  <td className="whitespace-nowrap px-4 py-2">{r.currency}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.rateToReportingCurrency.toFixed(6)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-neutral-500">{r.source}</td>
                  <td className="whitespace-nowrap px-4 py-2">{formatDate(r.asOfDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
