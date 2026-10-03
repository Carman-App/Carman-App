import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { Section } from "@/components/detail-view";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "./billing-nav";
import { backfillStartedSubscriptionEvents } from "@/lib/money/events";
import { ensureFxRatesSeeded } from "@/lib/money/fx";
import { getMrrSnapshot, getMonthlyMovement } from "@/lib/money/mrr";
import { formatCents, REPORTING_CURRENCY } from "@/lib/money/currency";

export const dynamic = "force-dynamic";

// MON-01 — "MRR + subscriber counts by plan, month's movement split
// new/expansion/contraction/churn, active subs per plan, trials running."

async function getBillingData() {
  const [plans, subscriptions] = await Promise.all([
    prisma.plan.findMany({ orderBy: { priceCents: "asc" } }),
    prisma.subscription.findMany({
      include: { plan: true, account: { include: { user: true } }, workshop: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return { plans, subscriptions };
}

export default async function BillingPage() {
  await requireRole(BILLING_ROLES);

  // Idempotent, safe on every load — see src/lib/money/events.ts and fx.ts.
  const [backfilledCount] = await Promise.all([backfillStartedSubscriptionEvents(), ensureFxRatesSeeded()]);

  const [{ plans, subscriptions }, mrr, movement] = await Promise.all([
    getBillingData(),
    getMrrSnapshot(),
    getMonthlyMovement(new Date()),
  ]);

  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    movement.monthStart,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Money</h1>
        <p className="text-sm text-neutral-500">
          Carma&rsquo;s own subscription revenue (Plan/Subscription) — strictly separate from
          mechanic-invoice money elsewhere in the console. No payment processor is connected yet
          (<code>STRIPE_SECRET_KEY</code> / <code>STRIPE_WEBHOOK_SECRET</code> are reserved,
          unset placeholders in <code>.env.example</code>) — everything below is built against real
          Plan/Subscription/Account/Workshop rows, with honest empty states wherever a real
          processor would be required.
        </p>
      </div>

      <BillingNav active="/billing" />

      <Section title="MRR (reporting currency: USD)">
        <p className="text-xs text-neutral-500">
          <code>Plan.priceCents</code> has no currency field — it is treated as denominated in the
          reporting currency (USD) per this work&rsquo;s brief. Non-USD subscriptions are converted
          using <code>FxRate</code> (seeded on this page load if empty — see &ldquo;Revenue by
          region&rdquo; for the rate table, source, and as-of date beside every conversion).
          {backfilledCount > 0 && (
            <>
              {" "}
              {backfilledCount} pre-existing subscription{backfilledCount === 1 ? "" : "s"} had no
              SubscriptionEvent row yet — a STARTED event was just backfilled from each one&rsquo;s
              real <code>createdAt</code> so this page and the cohort/movement views below aren&rsquo;t
              empty on day one.
            </>
          )}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Total MRR (converted, ACTIVE + PAST_DUE only)</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {formatCents(mrr.totalReportingCents, REPORTING_CURRENCY)}
            </p>
            {mrr.unconvertedCurrencies.length > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Excludes {mrr.unconvertedCurrencies.join(", ")} — no FxRate on file for these yet.
              </p>
            )}
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Trials running</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{mrr.trialsRunning}</p>
            {mrr.trialsRunningLegacy > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                {mrr.trialsRunningLegacy} of these predate the <code>trialStartedAt</code> field
                (null) — real, just missing a start date.
              </p>
            )}
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Net MRR change this month ({monthLabel})</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {movement.netReportingCentsChange >= 0 ? "+" : ""}
              {formatCents(movement.netReportingCentsChange, REPORTING_CURRENCY)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Currency (as charged)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Gross</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Converted ({REPORTING_CURRENCY})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {mrr.mrrByCurrency.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                    No ACTIVE or PAST_DUE subscriptions on file.
                  </td>
                </tr>
              )}
              {mrr.mrrByCurrency.map((row) => (
                <tr key={row.currency}>
                  <td className="whitespace-nowrap px-4 py-2">{row.currency}</td>
                  <td className="whitespace-nowrap px-4 py-2">{formatCents(row.grossCents, row.currency)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {row.convertedCents == null ? (
                      <span className="text-amber-600">No FxRate on file</span>
                    ) : (
                      formatCents(row.convertedCents, REPORTING_CURRENCY)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Movement this month — ${monthLabel} (derived from SubscriptionEvent)`}>
        <p className="text-xs text-neutral-500">
          Only reflects events recorded since SubscriptionEvent tracking began (today) plus this
          month&rsquo;s backfilled STARTED events — upgrade/downgrade/churn activity from earlier
          months isn&rsquo;t reconstructed, since no reliable historical event dates exist. This
          table will become fully accurate for every month going forward as real actions write real
          events (cancel, refund, extend-trial, etc.).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["New", movement.new_],
              ["Expansion", movement.expansion],
              ["Contraction", movement.contraction],
              ["Churn", movement.churn],
              ["Reactivation", movement.reactivation],
            ] as const
          ).map(([label, bucket]) => (
            <div key={label} className="rounded border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">{bucket.count}</p>
              <p className="text-xs text-neutral-500">
                {bucket.mrrDeltaReportingCents >= 0 ? "+" : ""}
                {formatCents(bucket.mrrDeltaReportingCents, REPORTING_CURRENCY)}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Subscriber counts by plan (ACTIVE + TRIALING + PAST_DUE)">
        <DataTable
          rows={mrr.subscriberCountsByPlan.map((r) => ({ id: r.planId, ...r }))}
          emptyLabel="No subscribers yet."
          columns={[
            { header: "Plan", cell: (r) => r.planName },
            { header: "Code", cell: (r) => r.planCode },
            { header: "Subscribers", cell: (r) => r.count },
          ]}
        />
      </Section>

      <Section title="Active subs per plan (ACTIVE only)">
        <DataTable
          rows={mrr.activeSubsByPlan.map((r) => ({ id: r.planId, ...r }))}
          emptyLabel="No ACTIVE subscriptions yet."
          columns={[
            { header: "Plan", cell: (r) => r.planName },
            { header: "Code", cell: (r) => r.planCode },
            { header: "Active subscribers", cell: (r) => r.count },
          ]}
        />
      </Section>

      <Section title="Bought in the app (App Store / Google Play)">
        <StoreSubscriptionsSection />
      </Section>

      <Section title="Plan catalog">
        <DataTable
          rows={plans}
          emptyLabel="No plans seeded yet."
          columns={[
            { header: "Code", cell: (r) => r.code },
            { header: "Name", cell: (r) => r.name },
            { header: "Subject", cell: (r) => <Badge value={r.subject} /> },
            { header: "Garages", cell: (r) => r.maxGarages ?? "Unlimited" },
            { header: "Vehicles", cell: (r) => r.maxVehicles ?? "Unlimited" },
            { header: "Jobs/mo", cell: (r) => r.maxJobsPerMonth ?? "Unlimited" },
            { header: "Staff", cell: (r) => r.maxStaff ?? "Unlimited" },
            {
              header: "Price",
              cell: (r) => (r.priceCents === 0 ? "Free" : formatCents(r.priceCents, REPORTING_CURRENCY)),
            },
          ]}
        />
      </Section>

      <Section title="Monthly accountant export (MON-10)">
        <p className="text-xs text-neutral-500">
          CSV of charges/refunds per line — account id, country, currency, gross, tax (always 0; no
          tax field exists anywhere in this schema), net, and the figure converted to{" "}
          {REPORTING_CURRENCY} with a total row that reconciles against this page&rsquo;s MRR
          movement for the same month.
        </p>
        <form action="/billing/export" method="get" className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500">Month</label>
            <input
              type="month"
              name="month"
              defaultValue={`${movement.monthStart.getUTCFullYear()}-${String(movement.monthStart.getUTCMonth() + 1).padStart(2, "0")}`}
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </div>
          <button type="submit" className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700">
            Download CSV
          </button>
        </form>
      </Section>

      <Section title="Subscriptions (most recent 200)">
        <DataTable
          rows={subscriptions}
          emptyLabel="No subscriptions yet."
          columns={[
            {
              header: "Subject",
              cell: (r) => r.account?.user.name ?? r.workshop?.name ?? "—",
            },
            { header: "Plan", cell: (r) => r.plan.name },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Trial started", cell: (r) => (r.trialStartedAt ? formatDate(r.trialStartedAt) : r.trialEndsAt ? "Unknown (pre-dates trialStartedAt)" : "—") },
            { header: "Trial ends", cell: (r) => formatDate(r.trialEndsAt) },
            { header: "Period ends", cell: (r) => formatDate(r.currentPeriodEnd) },
            { header: "Created", cell: (r) => formatDateTime(r.createdAt) },
          ]}
        />
      </Section>
    </div>
  );
}

/** Subscriptions sold through store billing (RevenueCat): by store, and the latest ones. */
async function StoreSubscriptionsSection() {
  const [byStore, latest] = await Promise.all([
    prisma.subscription.groupBy({ by: ["store", "status", "willRenew"], where: { store: { not: null } }, _count: { _all: true } }),
    prisma.subscription.findMany({
      where: { store: { not: null } },
      include: { plan: true, account: { include: { user: true } }, workshop: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <div className="space-y-3">
      <DataTable
        rows={byStore.map((r, i) => ({ id: String(i), ...r }))}
        emptyLabel="Nothing bought in the app yet (needs RevenueCat set up — DEPLOY.md, Subscriptions setup)."
        columns={[
          { header: "Store", cell: (r) => r.store },
          { header: "Status", cell: (r) => <Badge value={r.status} /> },
          { header: "Auto-renew", cell: (r) => (r.willRenew === false ? "Off" : "On") },
          { header: "Subscriptions", cell: (r) => r._count._all },
        ]}
      />
      <DataTable
        rows={latest}
        href={(r) => (r.accountId ? `/accounts/${r.accountId}` : `/workshops/${r.workshopId}`)}
        emptyLabel=""
        columns={[
          { header: "Who", cell: (r) => r.account?.user.name || r.workshop?.name || "—" },
          { header: "Plan", cell: (r) => r.plan.name },
          { header: "Product", cell: (r) => r.storeProductId ?? "—" },
          { header: "Status", cell: (r) => <Badge value={r.status} /> },
          { header: "Period ends", cell: (r) => formatDate(r.currentPeriodEnd) },
          { header: "Renews", cell: (r) => (r.willRenew === false ? "No" : "Yes") },
        ]}
      />
    </div>
  );
}
