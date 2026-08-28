import { requireRole, GROWTH_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { GrowthNav } from "../growth-nav";
import { getMechanicAttachRate, trailingWindow, ACTIVE_USER_CAVEAT } from "@/lib/growth/definitions";

export const dynamic = "force-dynamic";

// GROW-05 — mechanic attach rate, both directions. 90-day trailing window
// for both the "active" check and the Job lookback, per AGENTS.md's brief.

export default async function MechanicAttachPage() {
  await requireRole(GROWTH_ROLES);
  const range = trailingWindow(90);
  const attach = await getMechanicAttachRate(range);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Mechanic attach rate</h1>
        <p className="text-sm text-neutral-500">Trailing 90 days, both directions.</p>
      </div>

      <GrowthNav active="/growth/mechanic-attach" />

      <Section title="(a) Active owners with an attached Job">
        <p className="text-xs text-neutral-500">
          Share of active OWNER-profile accounts (lastApiRequestAt in the trailing 90 days —{" "}
          {ACTIVE_USER_CAVEAT}) with at least one Job raised in the last 90 days against a vehicle
          they own or belong to.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Active OWNER-profile accounts</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{attach.ownerSide.activeOwnerAccounts}</p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">With an attached Job</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{attach.ownerSide.withAttachedJob}</p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Attach rate</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {attach.ownerSide.ratePercent == null ? "—" : `${attach.ownerSide.ratePercent.toFixed(0)}%`}
            </p>
          </div>
        </div>
      </Section>

      <Section title="(b) Jobs referencing a real Carma vehicle">
        <p className="text-xs text-neutral-500">
          Share of Jobs raised in the last 90 days with <code>vehicleId != null</code> (i.e. the job
          references a real Carma-registered vehicle/owner, vs. a freeform walk-in with no
          registered vehicle).
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Total Jobs</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{attach.jobSide.totalJobs}</p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">With a real vehicle link</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{attach.jobSide.withRealVehicle}</p>
          </div>
          <div className="rounded border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">Rate</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {attach.jobSide.ratePercent == null ? "—" : `${attach.jobSide.ratePercent.toFixed(0)}%`}
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
