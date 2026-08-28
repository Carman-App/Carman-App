import Link from "next/link";
import { requireRole, GROWTH_ROLES, canRunAccountQuickAction } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { formatDate, formatDateTime } from "@/lib/format";
import { GrowthNav } from "../growth-nav";
import { getEngagementShortlist } from "@/lib/growth/engagement";
import { markChasedEngagement } from "./actions";

export const dynamic = "force-dynamic";

// GROW-08 — most-engaged shortlist, ranked by (records logged + distinct
// weeks active) in a trailing 90-day window.

export default async function EngagedPage() {
  const session = await requireRole(GROWTH_ROLES);
  const rows = await getEngagementShortlist(90);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Most engaged</h1>
        <p className="text-sm text-neutral-500">
          Ranked by (records logged + distinct weeks active) in the trailing 90 days. Contact
          permission reflects a real <code>PrivacyConsent(purpose=&quot;marketing&quot;)</code> row
          when one exists; that capture flow isn&rsquo;t built into onboarding yet (same gap
          PRIV-03 documents elsewhere in this build), so most rows will read &ldquo;not
          captured&rdquo; rather than a fabricated true/false. Mark a row &ldquo;chased&rdquo; once
          followed up so nobody chases the same account twice for this reason.
        </p>
      </div>

      <GrowthNav active="/growth/engaged" />

      <div className="flex justify-end">
        <Link
          href="/api/admin/growth/engaged-export"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
        >
          Export CSV
        </Link>
      </div>

      <Section title={`Shortlist (top ${rows.length})`}>
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Name</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Email</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Region</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Records (90d)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Distinct weeks active</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Score</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Contact permission</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Chased</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                    No accounts logged a record in the last 90 days.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.accountId} className={r.chasedEngagementAt ? "opacity-50" : "hover:bg-neutral-100"}>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link href={`/accounts/${r.accountId}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{r.email}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.region}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.recordCount}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.distinctWeeksActive}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.score}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.contactPermission === "not_captured" ? (
                      <span className="text-neutral-500">Not captured</span>
                    ) : r.contactPermission === "granted" ? (
                      <span className="text-emerald-600">Granted</span>
                    ) : (
                      <span className="text-red-600">Declined</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.chasedEngagementAt ? (
                      <span className="text-neutral-600" title={formatDateTime(r.chasedEngagementAt)}>
                        Chased {formatDate(r.chasedEngagementAt)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {!r.chasedEngagementAt && canRunAccountQuickAction(session.role) && (
                      <form action={markChasedEngagement}>
                        <input type="hidden" name="accountId" value={r.accountId} />
                        <button type="submit" className="text-xs text-neutral-700 hover:underline">
                          Mark chased
                        </button>
                      </form>
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
