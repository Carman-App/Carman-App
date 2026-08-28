import Link from "next/link";
import { Section } from "@/components/detail-view";
import { requireRole, SUPPORT_ROLES } from "@/lib/auth/rbac";
import { formatDate } from "@/lib/format";
import { titleCase } from "@/lib/format";
import {
  getWeeklyResponseMetrics,
  getOpenPastADayCount,
  getMonthlyClosedCategoryCounts,
} from "@/lib/support/metrics";

export const dynamic = "force-dynamic";

function minutesLabel(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / (60 * 24)).toFixed(1)}d`;
}

export default async function SupportMetricsPage() {
  await requireRole(SUPPORT_ROLES);
  const [weekly, openPastADay, monthlyCategories] = await Promise.all([
    getWeeklyResponseMetrics(8),
    getOpenPastADayCount(),
    getMonthlyClosedCategoryCounts(6),
  ]);

  const allCategories = new Set<string>();
  for (const m of monthlyCategories) {
    for (const c of Object.keys(m.counts)) allCategories.add(c);
  }
  const categoryList = [...allCategories].sort();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/support" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Ticket queue
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Response & resolution metrics</h1>
        <p className="text-sm text-neutral-500">
          Computed live from Ticket rows — nothing here is cached or stored separately.
        </p>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {openPastADay} ticket{openPastADay === 1 ? "" : "s"} still open or pending more than 24 hours
        after being opened.
      </div>

      <Section title="Median first-response and resolution time, by week opened">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Week of</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Opened</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Median first response</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Median resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {weekly.map((w) => (
                <tr key={w.weekStart.toISOString()}>
                  <td className="whitespace-nowrap px-4 py-2">{formatDate(w.weekStart)}</td>
                  <td className="whitespace-nowrap px-4 py-2">{w.ticketsOpened}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {minutesLabel(w.medianFirstResponseMinutes)}{" "}
                    <span className="text-neutral-500">({w.respondedCount} responded)</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {minutesLabel(w.medianResolutionMinutes)}{" "}
                    <span className="text-neutral-500">({w.resolvedCount} resolved)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Closed tickets by category, per month (SUP-06)">
        <p className="text-xs text-neutral-500">
          Only closed tickets are counted — category is required at close time, so an open/pending
          ticket has no category to count by yet.
        </p>
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Month</th>
                {categoryList.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-2 font-medium">
                    {titleCase(c)}
                  </th>
                ))}
                <th className="whitespace-nowrap px-4 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {monthlyCategories.map((m) => (
                <tr key={m.monthLabel}>
                  <td className="whitespace-nowrap px-4 py-2">{m.monthLabel}</td>
                  {categoryList.map((c) => (
                    <td key={c} className="whitespace-nowrap px-4 py-2">
                      {m.counts[c as keyof typeof m.counts] ?? 0}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{m.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
