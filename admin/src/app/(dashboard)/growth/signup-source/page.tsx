import { requireRole, GROWTH_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { GrowthNav } from "../growth-nav";
import { getSignupSourceBreakdown } from "@/lib/growth/signup-source";

export const dynamic = "force-dynamic";

// GROW-02 — Account.signupSource broken down through activation and paid
// conversion. See src/lib/growth/signup-source.ts for the query.

export default async function SignupSourcePage() {
  await requireRole(GROWTH_ROLES);
  const rows = await getSignupSourceBreakdown();
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Signup source</h1>
        <p className="text-sm text-neutral-500">
          <code>Account.signupSource</code> defaults to <code>UNKNOWN</code> and every account
          created before this field existed reads <code>UNKNOWN</code> — there is no historical
          backfill possible for those rows, since nothing recorded how they actually arrived.
          Any future signup path that doesn&rsquo;t explicitly pass a source will also read
          UNKNOWN going forward.
        </p>
      </div>

      <GrowthNav active="/growth/signup-source" />

      <Section title={`Breakdown (${total} accounts total)`}>
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Source</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Accounts</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Share</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Activated</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Activation rate</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Paid (ACTIVE/PAST_DUE sub)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Paid conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.map((r) => (
                <tr key={r.source}>
                  <td className="whitespace-nowrap px-4 py-2">{r.source}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.total}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {total === 0 ? "—" : `${((r.total / total) * 100).toFixed(0)}%`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{r.activated}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.activatedPercent == null ? "—" : `${r.activatedPercent.toFixed(0)}%`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{r.paid}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.paidPercent == null ? "—" : `${r.paidPercent.toFixed(0)}%`}
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
