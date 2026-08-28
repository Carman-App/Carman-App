import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { formatCents } from "@/lib/money/currency";
import { RequestCardButton } from "./request-card-button";
import Link from "next/link";
import { MaskedMoney } from "@/components/masked-money";

export const dynamic = "force-dynamic";

// MON-03 — "every failed payment with reason, retry attempts, next retry,
// whether user was told, action to request a new card."
//
// FailedPayment is a brand-new table and stays empty forever until a real
// payment processor (Stripe) is connected and pushes webhook failures — see
// .env.example's reserved STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET. This page
// is fully wired up to real rows; it is just honestly empty today.

export default async function FailedPaymentsPage() {
  await requireRole(BILLING_ROLES);

  const failedPayments = await prisma.failedPayment.findMany({
    include: { subscription: { include: { plan: true, account: { include: { user: true } }, workshop: true } } },
    orderBy: { attemptedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Failed payments</h1>
        <p className="text-sm text-neutral-500">
          Reads directly from the real <code>FailedPayment</code> table.
        </p>
      </div>

      <BillingNav active="/billing/failed-payments" />

      <Section title="Failed payments">
        <p className="text-xs text-neutral-500">
          Amounts are masked by default (PRIV-05) — click Reveal and state a reason to see the real
          figure; every reveal is audit-logged with the reason and which record was revealed.
        </p>
        {failedPayments.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
            No failed payments — no payment processor is connected yet (see <code>.env.example</code>
            &rsquo;s <code>STRIPE_SECRET_KEY</code>/<code>STRIPE_WEBHOOK_SECRET</code>); this table is
            wired up and ready to receive real webhook data once one is.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Account / Workshop</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Amount</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Reason</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Retries</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Next retry</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">User told</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {failedPayments.map((fp) => {
                  const subjectName = fp.subscription.account?.user.name ?? fp.subscription.workshop?.name ?? "—";
                  const accountId = fp.subscription.accountId ?? fp.subscription.workshop?.ownerId ?? null;
                  return (
                    <tr key={fp.id}>
                      <td className="whitespace-nowrap px-4 py-2">
                        {accountId ? <Link href={`/accounts/${accountId}`} className="hover:underline">{subjectName}</Link> : subjectName}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <MaskedMoney
                          value={formatCents(fp.amountCents, fp.currency)}
                          currency={fp.currency}
                          entityType="FailedPayment"
                          entityId={fp.id}
                          targetAccountId={accountId}
                          fieldLabel="failed payment amount"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">{fp.reasonCode ? titleCase(fp.reasonCode) : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2"><Badge value={fp.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2">{fp.retryCount}</td>
                      <td className="whitespace-nowrap px-4 py-2">{fp.nextRetryAt ? formatDateTime(fp.nextRetryAt) : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2">{fp.userNotifiedAt ? formatDateTime(fp.userNotifiedAt) : "No"}</td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <RequestCardButton failedPaymentId={fp.id} />
                      </td>
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
