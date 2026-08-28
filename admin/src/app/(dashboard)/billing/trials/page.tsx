import { Section } from "@/components/detail-view";
import { formatDate } from "@/lib/format";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { getTrialCohorts } from "@/lib/money/cohorts";

export const dynamic = "force-dynamic";

// MON-02 — "trial conversion by cohort (started per week, converted/lapsed/
// still running, median days to conversion)".

export default async function TrialsPage() {
  await requireRole(BILLING_ROLES);
  const cohorts = await getTrialCohorts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Trial cohorts</h1>
        <p className="text-sm text-neutral-500">
          Subscriptions grouped by the ISO week their trial started. Conversion is counted only from
          a real <code>SubscriptionEvent(type=TRIAL_CONVERTED)</code> row — that table starts empty
          and is never backfilled with a guessed conversion date, so cohorts from before this
          feature shipped will under-count &ldquo;converted&rdquo; even for subscriptions that are
          ACTIVE today. Going forward every real conversion should write that event so this becomes
          fully accurate.
        </p>
      </div>

      <BillingNav active="/billing/trials" />

      <Section title="Cohorts (most recent first)">
        {cohorts.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
            No subscriptions with a trial on file.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Cohort week</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Started</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Converted</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Lapsed</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Still running</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Median days to conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {cohorts.map((c) => (
                  <tr key={c.weekKey}>
                    <td className="whitespace-nowrap px-4 py-2">
                      {c.weekKey === "legacy" ? (
                        <span title="trialStartedAt is null on these — they pre-date that field">
                          Legacy (no trial start date)
                        </span>
                      ) : (
                        <>
                          {c.weekKey} ({c.weekStart ? formatDate(c.weekStart) : "—"})
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{c.started}</td>
                    <td className="whitespace-nowrap px-4 py-2">{c.converted}</td>
                    <td className="whitespace-nowrap px-4 py-2">{c.lapsed}</td>
                    <td className="whitespace-nowrap px-4 py-2">{c.stillRunning}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {c.medianDaysToConversion == null ? "—" : `${c.medianDaysToConversion.toFixed(1)} days`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
