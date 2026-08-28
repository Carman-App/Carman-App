import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { SubscriptionStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// MON-04 — "dunning list (who's in grace, days remaining, what they keep/
// lose)". `Subscription.graceEndsAt` is the real field this reads; nothing
// here fabricates a grace window that isn't actually on the row.

export default async function DunningPage() {
  await requireRole(BILLING_ROLES);

  const now = new Date();
  const inGrace = await prisma.subscription.findMany({
    where: { graceEndsAt: { not: null } },
    include: { plan: true, account: { include: { user: true } }, workshop: true },
    orderBy: { graceEndsAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Dunning</h1>
        <p className="text-sm text-neutral-500">
          Every subscription with a <code>graceEndsAt</code> set. Nothing in this codebase yet
          automatically enforces a cutoff when grace expires — no processor pushes real payment
          failures to start a grace window in the first place (see Failed payments), so this list
          will be empty until one exists, or until a grace window is set by hand. This page is
          read-only reporting on the real field.
        </p>
      </div>

      <BillingNav active="/billing/dunning" />

      <Section title="In grace">
        {inGrace.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
            No subscription currently has a grace window set.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Account / Workshop</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Plan</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Grace ends</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Days remaining</th>
                  <th className="px-4 py-2 font-medium">What they keep / lose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {inGrace.map((s) => {
                  const subjectName = s.account?.user.name ?? s.workshop?.name ?? "—";
                  const accountId = s.accountId ?? s.workshop?.ownerId ?? null;
                  const daysRemaining = s.graceEndsAt ? Math.ceil((s.graceEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  const lapsed = daysRemaining != null && daysRemaining <= 0;
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-2">
                        {accountId ? <Link href={`/accounts/${accountId}`} className="hover:underline">{subjectName}</Link> : subjectName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">{s.plan.name}</td>
                      <td className="whitespace-nowrap px-4 py-2"><Badge value={s.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2">{formatDateTime(s.graceEndsAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {lapsed ? <span className="text-red-600">Lapsed</span> : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`}
                      </td>
                      <td className="max-w-md px-4 py-2 text-xs text-neutral-600">
                        Keep: existing data (garages/vehicles/jobs/history) stays visible. Lose while
                        in grace but past due: nothing extra is enforced by this codebase today —
                        {s.status === SubscriptionStatus.PAST_DUE
                          ? " status is PAST_DUE, but no code path currently blocks new records/staff/jobs against the plan's limits during grace."
                          : " status is " + s.status + "."}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="PAST_DUE (for reference, whether or not a grace window is set)">
        <PastDueList />
      </Section>
    </div>
  );
}

async function PastDueList() {
  const pastDue = await prisma.subscription.findMany({
    where: { status: SubscriptionStatus.PAST_DUE },
    include: { plan: true, account: { include: { user: true } }, workshop: true },
    orderBy: { updatedAt: "desc" },
  });
  if (pastDue.length === 0) {
    return (
      <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        No PAST_DUE subscriptions.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-neutral-200">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            <th className="whitespace-nowrap px-4 py-2 font-medium">Account / Workshop</th>
            <th className="whitespace-nowrap px-4 py-2 font-medium">Plan</th>
            <th className="whitespace-nowrap px-4 py-2 font-medium">Grace set?</th>
            <th className="whitespace-nowrap px-4 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {pastDue.map((s) => {
            const subjectName = s.account?.user.name ?? s.workshop?.name ?? "—";
            const accountId = s.accountId ?? s.workshop?.ownerId ?? null;
            return (
              <tr key={s.id}>
                <td className="whitespace-nowrap px-4 py-2">
                  {accountId ? <Link href={`/accounts/${accountId}`} className="hover:underline">{subjectName}</Link> : subjectName}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{s.plan.name}</td>
                <td className="whitespace-nowrap px-4 py-2">{s.graceEndsAt ? formatDate(s.graceEndsAt) : "No"}</td>
                <td className="whitespace-nowrap px-4 py-2">{formatDateTime(s.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
