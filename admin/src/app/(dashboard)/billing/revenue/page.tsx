import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { formatDate } from "@/lib/format";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { REGION_LABELS, currencyForRegion } from "@/lib/region";
import { Region, SubscriptionStatus } from "@/generated/prisma/enums";
import { ensureFxRatesSeeded, getFxRateMap, convertCentsToReportingCurrency } from "@/lib/money/fx";
import { formatCents, REPORTING_CURRENCY } from "@/lib/money/currency";

export const dynamic = "force-dynamic";

// MON-09 — "revenue by country/currency with conversion basis stated (local
// currency as charged, converted to one reporting currency, rate source+date
// printed beside the figure)."

export default async function RevenuePage() {
  await requireRole(BILLING_ROLES);
  await ensureFxRatesSeeded();

  const subs = await prisma.subscription.findMany({
    where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] } },
    include: {
      plan: true,
      account: { select: { region: true } },
      workshop: { select: { owner: { select: { region: true } } } },
    },
  });
  const rates = await getFxRateMap();

  const byRegion = new Map<Region, { region: Region; currency: string; grossCents: number; count: number }>();
  for (const s of subs) {
    const region = s.account?.region ?? s.workshop?.owner.region;
    if (!region) continue;
    const currency = currencyForRegion(region);
    const existing = byRegion.get(region);
    if (existing) {
      existing.grossCents += s.plan.priceCents;
      existing.count += 1;
    } else {
      byRegion.set(region, { region, currency, grossCents: s.plan.priceCents, count: 1 });
    }
  }

  const rows = [...byRegion.values()]
    .map((r) => {
      const rate = rates.get(r.currency);
      const convertedCents = convertCentsToReportingCurrency(r.grossCents, r.currency, rates);
      return { ...r, convertedCents, rate };
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
