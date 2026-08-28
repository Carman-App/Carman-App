import { requireRole, GROWTH_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { GrowthNav } from "../growth-nav";
import { getInvitePerformance } from "@/lib/growth/invites";

export const dynamic = "force-dynamic";

// GROW-04 — sent/accepted GarageInvitation counts, share of accounts that
// trace back to an accepted invite, median/average acceptance time.

function hoursLabel(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export default async function InvitesPage() {
  await requireRole(GROWTH_ROLES);
  const perf = await getInvitePerformance();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Invite performance</h1>
        <p className="text-sm text-neutral-500">
          Computed from real <code>GarageInvitation</code> rows (status/createdAt/acceptedAt).
        </p>
      </div>

      <GrowthNav active="/growth/invites" />

      <Section title="Invitation status">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              ["Sent", perf.sent],
              ["Accepted", perf.accepted],
              ["Declined", perf.declined],
              ["Expired", perf.expired],
              ["Pending", perf.pending],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Acceptance rate: {perf.acceptedPercent == null ? "—" : `${perf.acceptedPercent.toFixed(0)}%`}
        </p>
      </Section>

      <Section title="Acceptance time (created -> accepted)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Median</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">{hoursLabel(perf.medianAcceptanceHours)}</p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Average</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">{hoursLabel(perf.averageAcceptanceHours)}</p>
          </div>
        </div>
      </Section>

      <Section title="Accounts traced back to an invite">
        <p className="text-xs text-neutral-500">
          Accounts don&rsquo;t store which invitation created them — there is no FK from{" "}
          <code>Account</code> back to <code>GarageInvitation</code>. The figure below is a
          best-effort match on lower-cased email against every ACCEPTED invitation&rsquo;s email,
          not a guaranteed causal link.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Email-matched to an accepted invite</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {perf.accountsMatchingAcceptedInviteEmail} / {perf.totalAccounts}
              <span className="ml-2 text-sm text-neutral-500">
                (
                {perf.accountsMatchingAcceptedInviteEmailPercent == null
                  ? "—"
                  : `${perf.accountsMatchingAcceptedInviteEmailPercent.toFixed(0)}%`}
                )
              </span>
            </p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">
              signupSource = INVITE (real field, more reliable going forward — GROW-02)
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">{perf.accountsWithSignupSourceInvite}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
