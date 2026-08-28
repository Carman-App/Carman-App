import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, MONEY_REFUND_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { currencyForSubscription, formatCents } from "@/lib/money/currency";
import { ApprovalStatus } from "@/generated/prisma/enums";
import { RequestRefundPanel, PendingRefundApprovalCard, type RefundableSubscription, type PendingRefundApproval } from "./refund-panel";
import { REFUND_APPROVAL_THRESHOLD_REPORTING_CENTS, REFUND_APPROVAL_PLAN_PRICE_FRACTION } from "@/lib/money/refunds";
import { MaskedMoney } from "@/components/masked-money";

export const dynamic = "force-dynamic";

// MON-07 — refund/credit with note; two-step confirm stating amount+party;
// second approval above a threshold. See src/lib/money/refunds.ts for the
// threshold's exact definition and justification.

async function getAdminNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();
  const admins = await prisma.adminUser.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true, email: true } });
  return new Map(admins.map((a) => [a.id, `${a.name} (${a.email})`]));
}

export default async function RefundsPage() {
  const session = await requireRole(MONEY_REFUND_ROLES);

  const [subscriptions, refundCredits, pendingApprovals] = await Promise.all([
    prisma.subscription.findMany({
      include: { plan: true, account: { include: { user: true } }, workshop: { include: { owner: { include: { user: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.refundCredit.findMany({
      include: { subscription: { include: { plan: true, account: { include: { user: true } }, workshop: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.twoPersonApproval.findMany({
      where: { entityType: "RefundCredit", action: "billing.refund", status: ApprovalStatus.PENDING },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const adminNames = await getAdminNames([...refundCredits.map((r) => r.requestedByAdminId), ...pendingApprovals.map((a) => a.requestedByAdminId)]);

  const options: RefundableSubscription[] = subscriptions.map((s) => ({
    id: s.id,
    currency: currencyForSubscription(s),
    partyLabel: s.account?.user.name ?? s.workshop?.owner.user.name ?? s.workshop?.name ?? s.id,
    planPriceCentsLabel: formatCents(s.plan.priceCents),
  }));

  const pendingCards: PendingRefundApproval[] = pendingApprovals.map((a) => ({
    approvalId: a.id,
    refundCreditId: (a.payload as { refundCreditId: string }).refundCreditId,
    requestedAt: a.requestedAt,
    requestedByLabel: adminNames.get(a.requestedByAdminId) ?? a.requestedByAdminId,
    requestedByAdminId: a.requestedByAdminId,
    reasonLine: a.reason,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Refunds &amp; credits</h1>
        <p className="text-sm text-neutral-500">
          Requires a reason always; requires a second FINANCE/OWNER admin&rsquo;s approval when the
          amount converts to at least ${(REFUND_APPROVAL_THRESHOLD_REPORTING_CENTS / 100).toFixed(2)}{" "}
          (reporting currency) or at least {REFUND_APPROVAL_PLAN_PRICE_FRACTION * 100}% of the
          subscription&rsquo;s plan price — see <code>src/lib/money/refunds.ts</code>. Execution is
          always a documented no-op: no payment processor is connected, so nothing here moves real
          money — it records the admin decision on the real <code>RefundCredit</code> row and writes a
          real <code>SubscriptionEvent(type=REFUNDED)</code>.
        </p>
      </div>

      <BillingNav active="/billing/refunds" />

      {pendingCards.length > 0 && (
        <Section title="Pending approval">
          <div className="space-y-3">
            {pendingCards.map((c) => (
              <PendingRefundApprovalCard key={c.approvalId} approval={c} currentAdminId={session.adminId} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Request a refund or credit">
        <RequestRefundPanel options={options} />
      </Section>

      <Section title="History">
        <p className="text-xs text-neutral-500">
          Amounts are masked by default (PRIV-05) — click Reveal and state a reason to see the real
          figure; every reveal is audit-logged with the reason and which record was revealed.
        </p>
        {refundCredits.length === 0 ? (
          <p className="text-sm text-neutral-500">No refund/credit requests yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Account / Workshop</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Type</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Amount</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Full?</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Requested by</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Reason</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {refundCredits.map((r) => {
                  const subjectName = r.subscription.account?.user.name ?? r.subscription.workshop?.name ?? "—";
                  const accountId = r.subscription.accountId ?? r.subscription.workshop?.ownerId ?? null;
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2">
                        {accountId ? <Link href={`/accounts/${accountId}`} className="hover:underline">{subjectName}</Link> : subjectName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">{r.type}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <MaskedMoney
                          value={formatCents(r.amountCents, r.currency)}
                          currency={r.currency}
                          entityType="RefundCredit"
                          entityId={r.id}
                          targetAccountId={accountId}
                          fieldLabel="refund/credit amount"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">{r.full ? "Full" : "Partial"}</td>
                      <td className="whitespace-nowrap px-4 py-2"><Badge value={r.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2">{adminNames.get(r.requestedByAdminId) ?? r.requestedByAdminId}</td>
                      <td className="max-w-xs truncate px-4 py-2" title={r.reason}>{r.reason}</td>
                      <td className="whitespace-nowrap px-4 py-2">{r.executedAt ? formatDateTime(r.executedAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
