import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Section } from "@/components/detail-view";
import { formatDate, titleCase } from "@/lib/format";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import { CancelPanel, type CancellableSubscription } from "./cancel-panel";

export const dynamic = "force-dynamic";

// MON-05 — "cancellation reasons grouped/counted linking to accounts, with
// tenure."

export default async function CancellationsPage() {
  await requireRole(BILLING_ROLES);

  const [cancelled, cancellable] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: SubscriptionStatus.CANCELED },
      include: { plan: true, account: { include: { user: true } }, workshop: true },
      orderBy: { cancelledAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: { status: { not: SubscriptionStatus.CANCELED } },
      include: { plan: true, account: { include: { user: true } }, workshop: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const grouped = new Map<string, number>();
  for (const s of cancelled) {
    const key = s.cancellationReason ?? "UNKNOWN (cancelled before this field existed)";
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  const groupedRows = [...grouped.entries()].sort((a, b) => b[1] - a[1]);

  const options: CancellableSubscription[] = cancellable.map((s) => ({
    id: s.id,
    label: `${s.account?.user.name ?? s.workshop?.name ?? s.id} — ${s.plan.name} (${s.status})`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Cancellations</h1>
        <p className="text-sm text-neutral-500">
          Reads <code>Subscription.status = CANCELED</code> with its real <code>cancellationReason</code>
          /<code>cancellationNote</code>/<code>cancelledAt</code> fields.
        </p>
      </div>

      <BillingNav active="/billing/cancellations" />

      <Section title="Grouped by reason">
        {groupedRows.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
            No cancellations on file yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {groupedRows.map(([reason, count]) => (
              <div key={reason} className="rounded border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">{titleCase(reason)}</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">{count}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="All cancellations">
        {cancelled.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Account / Workshop</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Plan</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Reason</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Note</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Cancelled</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Tenure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {cancelled.map((s) => {
                  const subjectName = s.account?.user.name ?? s.workshop?.name ?? "—";
                  const accountId = s.accountId ?? s.workshop?.ownerId ?? null;
                  const tenureDays = s.cancelledAt
                    ? Math.round((s.cancelledAt.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-2">
                        {accountId ? <Link href={`/accounts/${accountId}`} className="hover:underline">{subjectName}</Link> : subjectName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">{s.plan.name}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {s.cancellationReason ? titleCase(s.cancellationReason) : "Unknown (predates this field)"}
                      </td>
                      <td className="max-w-xs truncate px-4 py-2" title={s.cancellationNote ?? undefined}>
                        {s.cancellationNote ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">{formatDate(s.cancelledAt)}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        {tenureDays == null ? "—" : `${tenureDays} day${tenureDays === 1 ? "" : "s"}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Record a cancellation">
        <CancelPanel options={options} />
      </Section>
    </div>
  );
}
