import { requireRole, GROWTH_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { formatDate } from "@/lib/format";
import { GrowthNav } from "./growth-nav";
import { getSignupFunnelByCohort } from "@/lib/growth/funnel";

export const dynamic = "force-dynamic";

// GROW-01 — signup -> onboarded -> garage created -> vehicle added -> first
// record -> second record in a different ISO week. Count and % surviving
// each step, per weekly signup cohort. See src/lib/growth/funnel.ts for the
// exact query and the "verified" substitution note.

const STEPS = [
  { key: "signups", label: "Signed up" },
  { key: "onboarded", label: "Onboarded (has a profile)" },
  { key: "garageCreated", label: "Garage created" },
  { key: "vehicleAdded", label: "Vehicle added" },
  { key: "firstRecord", label: "First record" },
  { key: "secondRecordDifferentWeek", label: "2nd record, different ISO week" },
] as const;

export default async function GrowthFunnelPage() {
  await requireRole(GROWTH_ROLES);
  const cohorts = await getSignupFunnelByCohort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Growth</h1>
        <p className="text-sm text-neutral-500">
          GROW-01 signup funnel, broken out per weekly signup cohort. All figures are computed
          live from real Account/Garage/Vehicle/Record rows — nothing here is sample data.
        </p>
      </div>

      <GrowthNav active="/growth" />

      <Section title="Signup funnel by cohort">
        <p className="text-xs text-neutral-500">
          &ldquo;Verified&rdquo; is not a step here: this codebase has no self-serve email/phone
          verification flow an end-user goes through (<code>src/lib/auth/provider.ts</code> is an
          unwired OAuth abstraction; <code>User.emailVerifiedAt</code> exists but is only ever set
          by an admin&rsquo;s manual override, never by the user themselves). The closest real
          signal for &ldquo;onboarded&rdquo; is used instead: has at least one{" "}
          <code>AccountProfile</code> row. &ldquo;2nd record, different ISO week&rdquo; is read
          literally — the account&rsquo;s 2nd record ever falls in a different ISO week than its
          1st, not merely &ldquo;active across 2 distinct weeks at some point&rdquo;.
        </p>
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Cohort week</th>
                {STEPS.map((s) => (
                  <th key={s.key} className="whitespace-nowrap px-4 py-2 font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {cohorts.length === 0 && (
                <tr>
                  <td colSpan={STEPS.length + 1} className="px-4 py-8 text-center text-neutral-500">
                    No accounts on file.
                  </td>
                </tr>
              )}
              {cohorts.map((c) => (
                <tr key={c.weekKey}>
                  <td className="whitespace-nowrap px-4 py-2">
                    {c.weekKey} ({formatDate(c.weekStart)})
                  </td>
                  {STEPS.map((s) => {
                    const value = c[s.key];
                    const percent = c.signups === 0 ? null : (value / c.signups) * 100;
                    return (
                      <td key={s.key} className="whitespace-nowrap px-4 py-2">
                        {value}
                        {s.key !== "signups" && (
                          <span className="ml-1 text-xs text-neutral-500">
                            ({percent == null ? "—" : `${percent.toFixed(0)}%`})
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
