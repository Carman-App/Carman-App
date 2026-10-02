import { requireRole, GROWTH_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { formatDate } from "@/lib/format";
import { GrowthNav } from "../growth-nav";
import {
  getWeeklyRetentionGrid,
  getMonthlyRetentionGrid,
  SMALL_COHORT_THRESHOLD,
  type RetentionGrid,
} from "@/lib/growth/retention";

export const dynamic = "force-dynamic";

// GROW-03 — weekly and monthly cohort retention grid. See
// src/lib/growth/retention.ts for the query and the important structural
// caveat this page states below (every K>0 column reads 0, always).

function Grid({ grid, unit }: { grid: RetentionGrid; unit: "week" | "month" }) {
  return (
    <div className="overflow-x-auto rounded border border-neutral-200">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            <th className="whitespace-nowrap px-4 py-2 font-medium">Cohort</th>
            <th className="whitespace-nowrap px-4 py-2 font-medium">Cohort size</th>
            {grid.offsets.map((k) => (
              <th key={k} className="whitespace-nowrap px-4 py-2 font-medium">
                {unit} {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {grid.rows.length === 0 && (
            <tr>
              <td colSpan={grid.offsets.length + 2} className="px-4 py-8 text-center text-neutral-500">
                No accounts on file.
              </td>
            </tr>
          )}
          {grid.rows.map((row) => {
            const small = row.cohortSize < SMALL_COHORT_THRESHOLD;
            return (
              <tr key={row.cohortKey} className={small ? "opacity-50" : ""}>
                <td className="whitespace-nowrap px-4 py-2">
                  {row.cohortKey} ({formatDate(row.cohortStart)})
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {row.cohortSize}
                  {small && <span className="ml-1 text-xs text-amber-600">small</span>}
                </td>
                {row.retainedPercent.map((p, i) => (
                  <td key={i} className="whitespace-nowrap px-4 py-2">
                    {p == null ? "—" : `${p.toFixed(0)}%`}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function RetentionPage() {
  await requireRole(GROWTH_ROLES);
  const [weekly, monthly] = await Promise.all([getWeeklyRetentionGrid(), getMonthlyRetentionGrid()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Retention</h1>
        <p className="text-sm text-neutral-500">
          Cohorts grouped by signup week/month. Rows with a cohort size under {SMALL_COHORT_THRESHOLD}{" "}
          are greyed out and marked &ldquo;small&rdquo; so they aren&rsquo;t over-read.
        </p>
      </div>

      <GrowthNav active="/growth/retention" />

      <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        <strong>Retained</strong> means the account wrote a record (fuel/service/repair/expense/odometer) in that
        later calendar week/month — opening the app alone does not count. Week/month 0 shows activity in the signup
        period itself as a baseline.
      </div>

      <Section title="Weekly cohorts (most recent 12)">
        <Grid grid={weekly} unit="week" />
      </Section>

      <Section title="Monthly cohorts (most recent 6)">
        <Grid grid={monthly} unit="month" />
      </Section>
    </div>
  );
}
