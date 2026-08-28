import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { formatCents, currencyForSubscription } from "@/lib/money/currency";

/**
 * MON-06 — "one account's full billing history (charges/refunds/plan
 * changes with dates/prorating, card masked to brand+last4)."
 *
 * Standalone async Server Component (does its own Prisma queries) so the
 * lead agent can drop it straight into accounts/[id]/page.tsx without that
 * page needing to know Money's internals. Everything here reads real rows —
 * SubscriptionEvent/RefundCredit/FailedPayment all start empty until a real
 * action or a real payment processor writes to them, and this section says
 * so plainly rather than inventing history.
 */

async function getAdminNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();
  const admins = await prisma.adminUser.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, email: true },
  });
  return new Map(admins.map((a) => [a.id, `${a.name} (${a.email})`]));
}

export async function BillingHistorySection({ accountId }: { accountId: string }) {
  const subscriptions = await prisma.subscription.findMany({
    where: { accountId },
    include: {
      plan: true,
      account: { select: { region: true } },
      workshop: { select: { owner: { select: { region: true } } } },
      events: { orderBy: { occurredAt: "desc" } },
      refundCredits: { orderBy: { createdAt: "desc" } },
      failedPayments: { orderBy: { attemptedAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (subscriptions.length === 0) {
    return (
      <Section title="Billing history (MON-06)">
        <p className="text-sm text-neutral-500">No subscription on file for this account.</p>
      </Section>
    );
  }

  // Referenced fromPlanId/toPlanId are plain id columns on SubscriptionEvent
  // (no relation) — resolve their names in one batch for display.
  const referencedPlanIds = [
    ...new Set(
      subscriptions.flatMap((s) => s.events.flatMap((e) => [e.fromPlanId, e.toPlanId])).filter((id): id is string => Boolean(id)),
    ),
  ];
  const referencedPlans = referencedPlanIds.length
    ? await prisma.plan.findMany({ where: { id: { in: referencedPlanIds } }, select: { id: true, name: true } })
    : [];
  const planNameById = new Map(referencedPlans.map((p) => [p.id, p.name]));

  const adminIds = subscriptions.flatMap((s) => [
    ...s.events.map((e) => e.performedByAdminId),
    ...s.refundCredits.map((r) => r.requestedByAdminId),
  ]);
  const adminNames = await getAdminNames(adminIds);

  return (
    <Section title="Billing history (MON-06)">
      <p className="text-xs text-neutral-500">
        Carma&rsquo;s own subscription revenue — strictly separate from mechanic-invoice money
        elsewhere in this console. No payment processor is connected (see <code>.env.example</code>
        &rsquo;s <code>STRIPE_SECRET_KEY</code>/<code>STRIPE_WEBHOOK_SECRET</code>), so proration and
        card details below only ever appear once a real processor writes them.
      </p>

      {subscriptions.map((s) => {
        const currency = currencyForSubscription(s);
        return (
          <div key={s.id} className="space-y-3 rounded border border-neutral-200 p-4">
            <DetailView
              title={`${s.plan.name} (${s.subject})`}
              fields={[
                { label: "Status", value: <Badge value={s.status} /> },
                {
                  label: "Trial",
                  value: s.trialStartedAt
                    ? `${formatDate(s.trialStartedAt)} → ${formatDate(s.trialEndsAt)}`
                    : s.trialEndsAt
                      ? `Started unknown (predates trialStartedAt field) → ${formatDate(s.trialEndsAt)}`
                      : "No trial on file.",
                },
                { label: "Current period ends", value: formatDate(s.currentPeriodEnd) },
                {
                  label: "Cancellation",
                  value: s.cancelledAt
                    ? `${formatDateTime(s.cancelledAt)} — ${s.cancellationReason ? titleCase(s.cancellationReason) : "no reason on file"}${s.cancellationNote ? `: ${s.cancellationNote}` : ""}`
                    : "Not cancelled.",
                },
                {
                  label: "Dunning grace",
                  value: s.graceEndsAt ? `Ends ${formatDateTime(s.graceEndsAt)}` : "No grace window set.",
                },
                {
                  label: "Payment method",
                  value:
                    s.paymentMethodBrand && s.paymentMethodLast4
                      ? `${s.paymentMethodBrand} •••• ${s.paymentMethodLast4}`
                      : "No card on file — no payment processor is connected yet, so no masked card data has ever been written.",
                },
              ]}
            />

            <div>
              <p className="mb-1 text-xs font-medium text-neutral-600">Events (plan changes, trial/free-period grants, refunds)</p>
              {s.events.length === 0 ? (
                <p className="text-xs text-neutral-500">No events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-neutral-200">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">When</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Type</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Plan change</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Amount</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">By</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {s.events.map((e) => (
                        <tr key={e.id}>
                          <td className="whitespace-nowrap px-3 py-1.5">{formatDateTime(e.occurredAt)}</td>
                          <td className="whitespace-nowrap px-3 py-1.5"><Badge value={e.type} /></td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {e.fromPlanId || e.toPlanId
                              ? `${e.fromPlanId ? (planNameById.get(e.fromPlanId) ?? e.fromPlanId) : "—"} → ${e.toPlanId ? (planNameById.get(e.toPlanId) ?? e.toPlanId) : "—"}`
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {e.amountCents != null ? formatCents(e.amountCents, currency) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {e.performedByAdminId ? (adminNames.get(e.performedByAdminId) ?? e.performedByAdminId) : "System / backfilled"}
                          </td>
                          <td className="max-w-xs truncate px-3 py-1.5" title={e.note ?? undefined}>
                            {e.note ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-neutral-600">Refunds / credits</p>
              {s.refundCredits.length === 0 ? (
                <p className="text-xs text-neutral-500">None.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-neutral-200">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Type</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Amount</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Full?</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Status</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Requested by</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Reason</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Executed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {s.refundCredits.map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap px-3 py-1.5">{r.type}</td>
                          <td className="whitespace-nowrap px-3 py-1.5">{formatCents(r.amountCents, r.currency)}</td>
                          <td className="whitespace-nowrap px-3 py-1.5">{r.full ? "Full" : "Partial"}</td>
                          <td className="whitespace-nowrap px-3 py-1.5"><Badge value={r.status} /></td>
                          <td className="whitespace-nowrap px-3 py-1.5">
                            {adminNames.get(r.requestedByAdminId) ?? r.requestedByAdminId}
                          </td>
                          <td className="max-w-xs truncate px-3 py-1.5" title={r.reason}>{r.reason}</td>
                          <td className="whitespace-nowrap px-3 py-1.5">{r.executedAt ? formatDateTime(r.executedAt) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {s.failedPayments.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-neutral-600">Failed payments</p>
                <div className="overflow-x-auto rounded border border-neutral-200">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Attempted</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Amount</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Status</th>
                        <th className="whitespace-nowrap px-3 py-1.5 font-medium">Retries</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {s.failedPayments.map((fp) => (
                        <tr key={fp.id}>
                          <td className="whitespace-nowrap px-3 py-1.5">{formatDateTime(fp.attemptedAt)}</td>
                          <td className="whitespace-nowrap px-3 py-1.5">{formatCents(fp.amountCents, fp.currency)}</td>
                          <td className="whitespace-nowrap px-3 py-1.5"><Badge value={fp.status} /></td>
                          <td className="whitespace-nowrap px-3 py-1.5">{fp.retryCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex gap-3 text-xs">
        <Link href="/billing/refunds" className="text-neutral-600 hover:underline">
          Request a refund/credit →
        </Link>
        <Link href="/billing/grant-free-period" className="text-neutral-600 hover:underline">
          Extend trial / grant free period →
        </Link>
        <Link href="/billing/cancellations" className="text-neutral-600 hover:underline">
          Record a cancellation →
        </Link>
      </div>
    </Section>
  );
}
