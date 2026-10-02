import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  requireRole,
  ACCOUNT_BILLING_VIEW_ROLES,
  canRunDangerousAccountAction,
  canRunAccountQuickAction,
} from "@/lib/auth/rbac";
import { AdminRole } from "@/generated/prisma/enums";
import { REGION_LABELS, currencyForRegion } from "@/lib/region";
import { QuickActionsPanel } from "./quick-actions-panel";
import { SuspendPanel } from "./suspend-panel";
import { DeletePanel, RestorePanel } from "./delete-panel";
import { RegionPanel } from "./region-panel";
import { UndoMergeButton } from "./undo-merge-button";
import { BillingHistorySection } from "./billing-history-section";
import { TicketHistorySection } from "./ticket-history-section";
import { TrustSection } from "./trust-section";
import { MessagingHistorySection } from "./messaging-history-section";

export const dynamic = "force-dynamic";

const DELETE_GRACE_WINDOW_DAYS = 30;

async function getAccount(id: string) {
  return prisma.account.findUnique({
    where: { id },
    include: {
      user: true,
      profiles: true,
      garagesOwned: { include: { vehicles: true }, orderBy: { createdAt: "asc" } },
      garageMemberships: { include: { garage: { include: { vehicles: true } } } },
      workshopsOwned: true,
      workshopMemberships: { include: { workshop: true } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

async function getAdminNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();
  const admins = await prisma.adminUser.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, email: true },
  });
  return new Map(admins.map((a) => [a.id, `${a.name} (${a.email})`]));
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(ACCOUNT_BILLING_VIEW_ROLES);
  // MON-06 fix: FINANCE may enter this page (see ACCOUNT_BILLING_VIEW_ROLES),
  // but per FINANCE's Cannot-list ("open a user's records, photos or
  // receipts") every section below except identity + billing history is
  // hidden from a FINANCE viewer — checked throughout via `isFinanceViewer`.
  const isFinanceViewer = session.role === AdminRole.FINANCE;
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  // ACCT-08: a merged (losing) account's id keeps resolving, but shows only
  // a banner pointing at the account it was merged into.
  if (account.mergedIntoAccountId) {
    const mergeRecord = await prisma.accountMerge.findFirst({
      where: { secondaryAccountId: id, revertedAt: null },
      orderBy: { performedAt: "desc" },
    });
    const primary = await prisma.account.findUnique({
      where: { id: account.mergedIntoAccountId },
      include: { user: true },
    });
    return (
      <div className="space-y-4">
        <Link href="/accounts" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Accounts
        </Link>
        <div className="rounded border border-sky-200 bg-sky-50 p-6">
          <h1 className="text-lg font-semibold text-neutral-900">This account was merged</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Merged into{" "}
            {primary ? (
              <Link href={`/accounts/${primary.id}`} className="text-sky-700 hover:underline">
                {primary.user.name} ({primary.user.email})
              </Link>
            ) : (
              account.mergedIntoAccountId
            )}
            {mergeRecord && (
              <>
                {" "}
                on {formatDateTime(mergeRecord.performedAt)}. Reason: {mergeRecord.reason}
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  // ACCT-07: deleted state, shown instead of the normal sections while
  // within the grace window (and afterwards, an honest "no purge job runs"
  // message instead of a fake restore option).
  if (account.deletedAt) {
    const ageDays = (new Date().getTime() - account.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    const withinWindow = ageDays <= DELETE_GRACE_WINDOW_DAYS;
    const daysRemaining = Math.max(0, Math.ceil(DELETE_GRACE_WINDOW_DAYS - ageDays));
    const adminNames = await getAdminNames([account.deletedByAdminId]);
    return (
      <div className="space-y-4">
        <Link href="/accounts" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Accounts
        </Link>
        <div className="rounded border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-semibold text-neutral-900">{account.user.name} — deleted</h1>
          <p className="mt-2 text-sm text-neutral-700">
            Deleted on {formatDateTime(account.deletedAt)} by{" "}
            {(account.deletedByAdminId && adminNames.get(account.deletedByAdminId)) ?? "an admin"}.
          </p>
          {withinWindow ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-amber-700">
                {daysRemaining} day{daysRemaining === 1 ? "" : "s"} remaining to restore.
              </p>
              {canRunDangerousAccountAction(session.role) && <RestorePanel accountId={account.id} />}
            </div>
          ) : (
            <p className="mt-4 text-sm text-neutral-600">
              This account&rsquo;s data is past the recovery window — Carma does not currently have
              an automated purge job, but the console treats it as gone and no restore is offered.
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- Garages + role (dedupe garagesOwned against garageMemberships; per
  // prisma/seed.ts an owner usually also gets a GarageMember row, but the
  // schema doesn't guarantee it in every path) ------------------------------
  type GarageRow = { id: string; name: string; location: string; createdAt: Date; role: string; vehicleCount: number };
  const garageMap = new Map<string, GarageRow>();
  for (const gm of account.garageMemberships) {
    garageMap.set(gm.garageId, {
      id: gm.garage.id,
      name: gm.garage.name,
      location: gm.garage.location,
      createdAt: gm.garage.createdAt,
      role: gm.role,
      vehicleCount: gm.garage.vehicles.length,
    });
  }
  for (const g of account.garagesOwned) {
    if (!garageMap.has(g.id)) {
      garageMap.set(g.id, {
        id: g.id,
        name: g.name,
        location: g.location,
        createdAt: g.createdAt,
        role: "OWNER",
        vehicleCount: g.vehicles.length,
      });
    }
  }
  const garageRows = [...garageMap.values()];

  // --- Vehicles across every garage they belong to (owned or member) -------
  const vehicleMap = new Map<
    string,
    { id: string; make: string; model: string; year: number; plate: string; garageName: string; createdAt: Date }
  >();
  for (const g of account.garagesOwned) {
    for (const v of g.vehicles) {
      vehicleMap.set(v.id, { id: v.id, make: v.make, model: v.model, year: v.year, plate: v.plate, garageName: g.name, createdAt: v.createdAt });
    }
  }
  for (const gm of account.garageMemberships) {
    for (const v of gm.garage.vehicles) {
      vehicleMap.set(v.id, {
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        plate: v.plate,
        garageName: gm.garage.name,
        createdAt: v.createdAt,
      });
    }
  }
  const vehicleRows = [...vehicleMap.values()];

  // --- ACCT-03 derived onboarding trail (owned garages/vehicles only, per
  // AGENTS.md: garage step is measured from garagesOwned specifically) ------
  const hasOwnerProfile = account.profiles.some((p) => p.type === "OWNER");
  const ownedVehiclesSorted = account.garagesOwned
    .flatMap((g) => g.vehicles)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const earliestOwnedVehicleCreatedAt = ownedVehiclesSorted[0]?.createdAt ?? null;
  const earliestProfileCreatedAt =
    account.profiles.length > 0
      ? account.profiles.reduce((min, p) => (p.createdAt < min ? p.createdAt : min), account.profiles[0].createdAt)
      : null;
  const earliestOwnedGarageCreatedAt = account.garagesOwned[0]?.createdAt ?? null; // already ordered asc

  const onboardingSteps: { step: string; at: Date | null }[] = [
    { step: "Country", at: account.createdAt },
    { step: "Profile", at: earliestProfileCreatedAt },
    { step: "Vehicle type", at: earliestOwnedVehicleCreatedAt },
    { step: "Make & model", at: earliestOwnedVehicleCreatedAt },
    { step: "Usage", at: earliestOwnedVehicleCreatedAt },
    { step: "Garage", at: earliestOwnedGarageCreatedAt },
    { step: "Odometer", at: earliestOwnedVehicleCreatedAt },
  ];
  const stoppedOnStep = onboardingSteps.find((s) => s.at === null)?.step ?? null;

  // --- Admin actions taken on this account (compact) ------------------------
  const auditEntries = await prisma.auditLog.findMany({
    where: { targetAccountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // --- Recent merges where this account is the surviving primary -----------
  const recentMerges = await prisma.accountMerge.findMany({
    where: { primaryAccountId: account.id },
    orderBy: { performedAt: "desc" },
    take: 10,
  });

  // --- ACCT-07/AUD-03: pending two-person-approved deletion request, if any -
  const pendingDeletionRow = await prisma.twoPersonApproval.findFirst({
    where: { entityType: "Account", entityId: account.id, action: "account.delete", status: "PENDING" },
    orderBy: { requestedAt: "desc" },
  });

  const adminNameIds = [
    account.user.emailVerifiedByAdminId,
    account.suspendedByAdminId,
    account.chasedNoVehicleByAdminId,
    ...auditEntries.map((e) => e.actorId),
    ...recentMerges.map((m) => m.performedByAdminId),
    pendingDeletionRow?.requestedByAdminId,
  ];
  const adminNames = await getAdminNames(adminNameIds);

  const pendingDeletion = pendingDeletionRow
    ? {
        id: pendingDeletionRow.id,
        requestedAt: pendingDeletionRow.requestedAt,
        requestedByAdminId: pendingDeletionRow.requestedByAdminId,
        requestedByLabel: adminNames.get(pendingDeletionRow.requestedByAdminId) ?? pendingDeletionRow.requestedByAdminId,
        reason: pendingDeletionRow.reason,
      }
    : null;

  const currentSubscription = account.subscriptions[0] ?? null;
  const canDangerous = canRunDangerousAccountAction(session.role);
  const canQuick = canRunAccountQuickAction(session.role);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounts" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Accounts
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">{account.user.name}</h1>
        {account.suspendedAt && (
          <p className="mt-1 inline-block rounded border border-amber-200 bg-amber-100 px-2 py-1 text-xs text-amber-700">
            Suspended
          </p>
        )}
      </div>

      {isFinanceViewer && (
        <p className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Finance view — identity and billing history only. Garages, vehicles, workshops, tickets,
          trust &amp; safety, messaging, and admin-action history are hidden here (FINANCE cannot
          open a user&rsquo;s records, photos, or receipts).
        </p>
      )}

      <DetailView
        title="Identity"
        fields={[
          { label: "Name", value: account.user.name },
          { label: "Email", value: account.user.email },
          {
            label: "Email verification",
            value: account.user.emailVerifiedAt ? (
              <span>
                Verified {formatDateTime(account.user.emailVerifiedAt)} —{" "}
                {account.user.emailVerifiedSource === "ADMIN" ? (
                  <>
                    by admin{" "}
                    {(account.user.emailVerifiedByAdminId && adminNames.get(account.user.emailVerifiedByAdminId)) ??
                      account.user.emailVerifiedByAdminId}
                  </>
                ) : (
                  "self-verified"
                )}
              </span>
            ) : (
              "Not verified"
            ),
          },
          { label: "Phone", value: "Not tracked (no phone field exists in this product)." },
          {
            label: "Region / currency",
            value: `${REGION_LABELS[account.region]} (${account.region}) → ${currencyForRegion(account.region)}`,
          },
          {
            label: "Units",
            value:
              "Not tracked — no measurement-system field exists; odometer fields are km-based throughout, implying metric, but there is no explicit per-account unit setting.",
          },
          {
            label: "Profiles",
            value: (
              <div className="flex gap-1">
                {account.profiles.length === 0 && "—"}
                {account.profiles.map((p) => (
                  <Badge key={p.id} value={`${p.type}${p.isActive ? " (active)" : ""}`} />
                ))}
              </div>
            ),
          },
          { label: "Joined", value: formatDateTime(account.createdAt) },
          {
            label: "Last API activity",
            value: account.lastApiRequestAt
              ? `${formatDateTime(account.lastApiRequestAt)} (proxy for last active — no app-open/session analytics exist yet)`
              : "No recorded API activity yet.",
          },
          { label: "Account ID", value: account.id },
        ]}
      />

      {!isFinanceViewer && (
        <>
          <Section title="Garages + role">
            <DataTable
              rows={garageRows}
              href={(r) => `/garages/${r.id}`}
              emptyLabel="Belongs to no garages."
              columns={[
                { header: "Name", cell: (r) => r.name },
                { header: "Role", cell: (r) => <Badge value={r.role} /> },
                { header: "Vehicles", cell: (r) => r.vehicleCount },
                { header: "Location", cell: (r) => r.location },
                { header: "Created", cell: (r) => formatDate(r.createdAt) },
              ]}
            />
          </Section>

          <Section title="Vehicles">
            <DataTable
              rows={vehicleRows}
              href={(r) => `/vehicles/${r.id}`}
              emptyLabel="No vehicles across any of their garages."
              columns={[
                { header: "Vehicle", cell: (r) => `${r.year} ${r.make} ${r.model}` },
                { header: "Plate", cell: (r) => r.plate },
                { header: "Garage", cell: (r) => r.garageName },
              ]}
            />
          </Section>

          <Section title="Workshops owned">
            <DataTable
              rows={account.workshopsOwned}
              href={(r) => `/workshops/${r.id}`}
              emptyLabel="Owns no workshops."
              columns={[
                { header: "Name", cell: (r) => r.name },
                { header: "Created", cell: (r) => formatDate(r.createdAt) },
              ]}
            />
          </Section>
        </>
      )}

      <Section title="Plan & payment state">
        <DetailView
          title="Subscription"
          subtitle="See Billing history below for charges, refunds and plan changes."
          fields={[
            {
              label: "Current plan",
              value: currentSubscription ? `${currentSubscription.plan.name} (${currentSubscription.subject})` : "No subscription on file.",
            },
            {
              label: "Status",
              value: currentSubscription ? <Badge value={currentSubscription.status} /> : "—",
            },
          ]}
        />
        <DataTable
          rows={account.subscriptions}
          emptyLabel="No subscription history."
          columns={[
            { header: "Plan", cell: (r) => r.plan.name },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Trial ends", cell: (r) => formatDate(r.trialEndsAt) },
            { header: "Period ends", cell: (r) => formatDate(r.currentPeriodEnd) },
          ]}
        />
      </Section>

      <Section title="Billing history (MON-06)">
        <BillingHistorySection accountId={account.id} />
      </Section>

      {!isFinanceViewer && (
      <>
      <Section title="Device / app version (ACCT-09)">
        <DetailView
          title="Device"
          subtitle="Not tracked anywhere in this codebase — there is no device-registration table and the mobile app has no telemetry, so 'flagged when behind current release' can't be computed here."
          fields={[
            { label: "Device", value: "Not yet tracked" },
            { label: "OS", value: "Not yet tracked" },
            { label: "App build", value: "Not yet tracked" },
            { label: "Last seen", value: "Not yet tracked" },
          ]}
        />
      </Section>

      <Section title="Tickets">
        <TicketHistorySection accountId={account.id} />
      </Section>

      <Section title="Trust & safety">
        <TrustSection accountId={account.id} />
      </Section>

      <Section title="Messaging">
        <MessagingHistorySection accountId={account.id} />
      </Section>

      <Section title="Onboarding trail (ACCT-03)">
        {!hasOwnerProfile ? (
          <p className="text-sm text-neutral-500">
            Not applicable — mechanic accounts don&rsquo;t go through the vehicle-owner onboarding
            wizard.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500">
              Derived from account data — true per-step timestamps aren&rsquo;t captured yet
              (onboarding writes nothing to the server until the wizard finishes), so this
              reconstructs the trail from what each step implies rather than observing it directly.
            </p>
            <ol className="space-y-1 text-sm">
              {onboardingSteps.map((s, i) => (
                <li key={s.step} className="flex items-center gap-2">
                  <span className="w-5 text-neutral-500">{i + 1}.</span>
                  <span className={s.at ? "text-neutral-800" : "text-neutral-500"}>{s.step}</span>
                  <span className="text-neutral-500">— {s.at ? formatDateTime(s.at) : "not reached"}</span>
                  {stoppedOnStep === s.step && (
                    <span className="rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                      stopped here
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Section>

      <Section title="Admin actions taken on this account">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">When</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Actor</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Action</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {auditEntries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                    No admin actions recorded against this account yet.
                  </td>
                </tr>
              )}
              {auditEntries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2">{formatDateTime(e.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {(e.actorId && adminNames.get(e.actorId)) ?? e.actorId ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{e.action}</td>
                  <td className="max-w-xs truncate px-4 py-2" title={e.reason ?? undefined}>
                    {e.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link href={`/audit?targetAccountId=${account.id}`} className="text-sm text-neutral-600 hover:underline">
          Full audit history for this account →
        </Link>
      </Section>
      </>
      )}

      {canQuick && (
        <QuickActionsPanel accountId={account.id} emailVerified={Boolean(account.user.emailVerifiedAt)} />
      )}

      {canDangerous && (
        <>
          <Section title="Suspend (ACCT-06)">
            <SuspendPanel
              accountId={account.id}
              suspension={
                account.suspendedAt && account.suspendedReason
                  ? {
                      suspendedAt: account.suspendedAt,
                      suspendedReason: account.suspendedReason,
                      suspendedNote: account.suspendedNote,
                      suspendedByAdminId: account.suspendedByAdminId,
                    }
                  : null
              }
            />
          </Section>

          <Section title="Country / currency correction (ACCT-10)">
            <RegionPanel accountId={account.id} currentRegion={account.region} />
          </Section>

          <Section title="Merge (ACCT-08)">
            <div className="space-y-3">
              <Link
                href={`/accounts/${account.id}/merge`}
                className="inline-block rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500"
              >
                Merge another account into this one →
              </Link>
              {recentMerges.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500">Recent merges into this account</p>
                  <ul className="mt-1 space-y-2 text-sm">
                    {recentMerges.map((m) => (
                      <li key={m.id} className="rounded border border-neutral-200 p-2">
                        <p className="text-neutral-700">
                          Secondary <Link href={`/accounts/${m.secondaryAccountId}`} className="hover:underline">{m.secondaryAccountId}</Link>{" "}
                          merged {formatDateTime(m.performedAt)} by {adminNames.get(m.performedByAdminId) ?? m.performedByAdminId} — {m.reason}
                        </p>
                        {m.revertedAt ? (
                          <p className="text-xs text-neutral-500">
                            Reverted {formatDateTime(m.revertedAt)} by{" "}
                            {(m.revertedByAdminId && adminNames.get(m.revertedByAdminId)) ?? m.revertedByAdminId}
                          </p>
                        ) : (
                          <UndoMergeButton mergeId={m.id} />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>

          <Section title="Delete (ACCT-07)">
            <DeletePanel accountId={account.id} pendingDeletion={pendingDeletion} currentAdminId={session.adminId} />
          </Section>
        </>
      )}
    </div>
  );
}
