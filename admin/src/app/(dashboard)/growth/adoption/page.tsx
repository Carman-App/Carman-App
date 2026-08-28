import { requireRole, GROWTH_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { GrowthNav } from "../growth-nav";
import { getFeatureAdoption } from "@/lib/growth/adoption";

export const dynamic = "force-dynamic";

// GROW-06 — distinct accounts using each feature in the last 30 days, with
// a trend vs. the prior 30 days.

export default async function AdoptionPage() {
  await requireRole(GROWTH_ROLES);
  const rows = await getFeatureAdoption();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Feature adoption</h1>
        <p className="text-sm text-neutral-500">
          Distinct accounts using each feature in the last 30 days vs. the prior 30 days.
          &ldquo;Project vehicles&rdquo; and &ldquo;Inspections&rdquo; have no account column of
          their own — both are attributed to the inspected/built vehicle&rsquo;s owning account
          (Garage.ownerId), not to the workshop mechanic who performed the work. See{" "}
          <code>src/lib/growth/adoption.ts</code> for the exact attribution per feature.
        </p>
      </div>

      <GrowthNav active="/growth/adoption" />

      <Section title="Adoption (last 30 days vs. prior 30 days)">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Feature</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Distinct accounts (30d)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Prior 30 days</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((r) => (
                <tr key={r.feature}>
                  <td className="whitespace-nowrap px-4 py-2">{r.label}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.current}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.prior}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.trendPercent == null ? (
                      "—"
                    ) : (
                      <span className={r.trendPercent >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {r.trendPercent >= 0 ? "+" : ""}
                        {r.trendPercent.toFixed(0)}%
                      </span>
                    )}
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
