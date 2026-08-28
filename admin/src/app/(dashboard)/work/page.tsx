import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Section } from "@/components/detail-view";
import { formatMoney } from "@/lib/format";
import { requireRole, WORK_ROLES } from "@/lib/auth/rbac";
import { getJobAgingReport, JOB_AGE_ALERT_THRESHOLD_DAYS } from "@/lib/work/job-aging";
import { getMechanicMoneyTotals, OVERDUE_AGE_BUCKETS } from "@/lib/work/mechanic-money";
import { getOutlierReport, MIN_JOB_COUNT_FOR_OUTLIER, OUTLIER_MEDIAN_MULTIPLIER } from "@/lib/work/outliers";

export const dynamic = "force-dynamic";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export default async function WorkOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ workshopId?: string }>;
}) {
  await requireRole(WORK_ROLES);
  const { workshopId } = await searchParams;

  const [aging, money, outliers, workshops] = await Promise.all([
    getJobAgingReport(),
    getMechanicMoneyTotals(),
    getOutlierReport(),
    prisma.workshop.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const staleJobs = workshopId ? aging.staleJobs.filter((j) => j.workshopId === workshopId) : aging.staleJobs;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Work overview</h1>
        <p className="text-sm text-neutral-500">
          Platform-wide job states and age, mechanic-side money, and workshop outliers — across every
          workshop, not scoped to one.
        </p>
      </div>

      <Section title="Job states, by age">
        <p className="text-xs text-neutral-500">
          &ldquo;Age&rdquo; is time since a job entered its current status. {aging.jobsWithEventHistory} of{" "}
          {aging.totalJobs} jobs have real status-change history to compute that from (JobStatusEvent, only
          written going forward from this feature shipping) — the rest fall back to the job&rsquo;s
          last-updated timestamp as a proxy.
        </p>
        <DataTable
          rows={aging.byState.map((row) => ({ id: row.status, ...row }))}
          emptyLabel="No jobs yet."
          columns={[
            { header: "State", cell: (r) => <Badge value={r.status} /> },
            { header: "Count", cell: (r) => r.count },
            {
              header: "Median age",
              cell: (r) => (r.medianAgeDays == null ? "—" : `${r.medianAgeDays.toFixed(1)} days`),
            },
          ]}
        />
      </Section>

      <Section title={`Jobs open longer than ${JOB_AGE_ALERT_THRESHOLD_DAYS} days`}>
        <form className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-neutral-500">Workshop</label>
            <select
              name="workshopId"
              defaultValue={workshopId ?? ""}
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            >
              <option value="">All workshops</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
          >
            Filter
          </button>
          {workshopId && (
            <Link href="/work" className="text-xs text-neutral-500 hover:text-neutral-700">
              Clear
            </Link>
          )}
        </form>
        <DataTable
          rows={staleJobs.slice(0, 200)}
          href={(r) => `/jobs/${r.id}`}
          emptyLabel="Nothing open past the threshold — good sign, or nobody's used status changes yet."
          columns={[
            { header: "Workshop", cell: (r) => r.workshopName },
            { header: "Fault", cell: (r) => r.faultDescription },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Age", cell: (r) => `${r.ageDays.toFixed(1)} days` },
            {
              header: "Age source",
              cell: (r) => (r.ageSource === "status_event" ? "Status history" : "Updated-at fallback"),
            },
          ]}
        />
        {staleJobs.length > 200 && (
          <p className="text-xs text-neutral-500">Showing the oldest 200 of {staleJobs.length}.</p>
        )}
      </Section>

      <Section title="Mechanic-side money (not Carma's own subscription revenue)">
        <div className="rounded border border-sky-200 bg-sky-50 p-4 space-y-4">
          <p className="text-xs text-sky-800">
            This is money workshops invoice their own customers and collect through the platform.
            It is entirely separate from Carma&rsquo;s subscription revenue (see Billing & Plans) —
            never combine these numbers.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Invoiced" value={formatMoney(money.invoicedTotal)} hint={`${money.invoiceCount} invoices`} />
            <StatTile label="Paid" value={formatMoney(money.paidTotal)} />
            <StatTile label="Outstanding" value={formatMoney(money.outstandingTotal)} />
            <StatTile
              label="Overdue"
              value={formatMoney(money.overdueTotal)}
              hint={`${money.overdueInvoiceCount} invoices`}
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-neutral-500">Overdue ageing, by days past due date</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OVERDUE_AGE_BUCKETS.map((bucket) => (
                <StatTile key={bucket} label={`${bucket} days`} value={formatMoney(money.overdueByBucket[bucket])} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Outliers — decline, dispute, and repeat-visit rates">
        <p className="text-xs text-neutral-500">
          Only workshops with at least {MIN_JOB_COUNT_FOR_OUTLIER} jobs are considered ({outliers.totalWorkshopsEligible}{" "}
          of {outliers.totalWorkshopsConsidered} workshops) — below that a rate is too noisy to call an
          outlier. Flagged means the rate is at least {OUTLIER_MEDIAN_MULTIPLIER}x the platform median among
          eligible workshops (or clears a small floor when the median is zero). Repeat-visit rate is a simple
          heuristic: jobs on the same vehicle at the same workshop within 90 days with a matching or
          substring-matching fault description — not a real fault taxonomy. Disputes are a brand-new table;
          expect most counts to be zero right now.
        </p>
        <DataTable
          rows={outliers.eligibleWorkshops.map((r) => ({ id: r.workshopId, ...r }))}
          href={(r) => `/workshops/${r.workshopId}`}
          emptyLabel="No workshop has enough jobs yet to compute an outlier rate."
          columns={[
            { header: "Workshop", cell: (r) => r.workshopName },
            { header: "Jobs", cell: (r) => r.jobCount },
            {
              header: "Estimate decline rate",
              cell: (r) => (
                <span className={r.flags.estimateDecline ? "text-amber-600" : ""}>
                  {r.estimateDeclineRate == null ? "—" : `${(r.estimateDeclineRate * 100).toFixed(0)}%`}
                  {r.flags.estimateDecline ? " ⚠" : ""}
                </span>
              ),
            },
            {
              header: "Disputes",
              cell: (r) => (
                <span className={r.flags.dispute ? "text-amber-600" : ""}>
                  {r.disputeCount}
                  {r.flags.dispute ? " ⚠" : ""}
                </span>
              ),
            },
            {
              header: "Repeat-visit rate",
              cell: (r) => (
                <span className={r.flags.repeatVisit ? "text-amber-600" : ""}>
                  {(r.repeatVisitRate * 100).toFixed(0)}%{r.flags.repeatVisit ? " ⚠" : ""}
                </span>
              ),
            },
          ]}
        />
        <p className="text-xs text-neutral-500">
          Platform medians (eligible workshops only): decline{" "}
          {outliers.medianEstimateDeclineRate == null ? "—" : `${(outliers.medianEstimateDeclineRate * 100).toFixed(0)}%`},
          disputes {outliers.medianDisputeCount}, repeat-visit {(outliers.medianRepeatVisitRate * 100).toFixed(0)}%.
        </p>
      </Section>
    </div>
  );
}
