import "server-only";
import { prisma } from "@/lib/prisma";
import { RefundCreditStatus, SubscriptionEventType } from "@/generated/prisma/enums";
import { convertCentsToReportingCurrency, type FxRateRow } from "./fx";

// MON-07 — "refund/credit with note ... two-step confirm ... second approval
// above a threshold." Per AGENTS.md's brief for this work: "pick [a
// threshold], just name and justify the constant clearly."
//
// Threshold chosen: a refund/credit requires a second admin's approval
// (src/lib/approvals.ts) when EITHER:
//   - it converts to >= $100 in the reporting currency (USD), OR
//   - it is >= 50% of the subscription's plan's monthly priceCents
//     (comparing in reporting-currency terms, since Plan.priceCents has no
//     currency field and is treated as reporting-currency per this work's
//     brief),
//   - or the amount can't be converted at all (no FxRate for that currency)
//     — treated as "can't verify it's under threshold", so it's routed to
//     approval rather than silently trusted.
// Below all of that, a single BILLING/MONEY_REFUND_ROLES admin plus a
// required reason is enough, matching Phase One's suspend/dangerous-action
// pattern ("reason is often enough, threshold-based amounts need a second
// person").
export const REFUND_APPROVAL_THRESHOLD_REPORTING_CENTS = 100_00; // $100.00
export const REFUND_APPROVAL_PLAN_PRICE_FRACTION = 0.5;

export function refundNeedsApproval(
  input: { amountCents: number; currency: string; planPriceCents: number },
  rates: Map<string, FxRateRow>,
): { needsApproval: boolean; convertedReportingCents: number | null; reasonLabel: string } {
  const convertedReportingCents = convertCentsToReportingCurrency(input.amountCents, input.currency, rates);

  if (convertedReportingCents == null) {
    return {
      needsApproval: true,
      convertedReportingCents: null,
      reasonLabel: `no FxRate on file for ${input.currency} — can't verify it's under threshold`,
    };
  }
  if (convertedReportingCents >= REFUND_APPROVAL_THRESHOLD_REPORTING_CENTS) {
    return {
      needsApproval: true,
      convertedReportingCents,
      reasonLabel: `>= $${(REFUND_APPROVAL_THRESHOLD_REPORTING_CENTS / 100).toFixed(2)} equivalent`,
    };
  }
  if (convertedReportingCents >= input.planPriceCents * REFUND_APPROVAL_PLAN_PRICE_FRACTION) {
    return {
      needsApproval: true,
      convertedReportingCents,
      reasonLabel: `>= ${REFUND_APPROVAL_PLAN_PRICE_FRACTION * 100}% of the plan's monthly price`,
    };
  }
  return { needsApproval: false, convertedReportingCents, reasonLabel: "under threshold" };
}

/**
 * The actual money-movement step, always a documented no-op — see MON-07's
 * brief ("the actual 'money moves' step must be a documented no-op"). Used
 * both by the direct (below-threshold) path and by approveAndExecute's
 * callback (above-threshold path) so there is exactly one place that ever
 * marks a RefundCredit EXECUTED.
 */
export async function executeRefundCredit(refundCreditId: string) {
  const refundCredit = await prisma.refundCredit.findUnique({ where: { id: refundCreditId } });
  if (!refundCredit) throw new Error("Refund/credit request not found.");
  if (refundCredit.status === RefundCreditStatus.EXECUTED) throw new Error("Already executed.");
  if (refundCredit.status === RefundCreditStatus.DENIED) throw new Error("This request was denied.");

  const now = new Date();
  const executionNote =
    "No payment processor connected — no real refund was issued; this records the admin decision only.";

  const [updated] = await prisma.$transaction([
    prisma.refundCredit.update({
      where: { id: refundCreditId },
      data: { status: RefundCreditStatus.EXECUTED, executedAt: now, executionNote },
    }),
    prisma.subscriptionEvent.create({
      data: {
        subscriptionId: refundCredit.subscriptionId,
        type: SubscriptionEventType.REFUNDED,
        amountCents: refundCredit.amountCents,
        occurredAt: now,
        note: `${refundCredit.type} — ${refundCredit.reason}`,
        metadata: { refundCreditId: refundCredit.id, full: refundCredit.full, executionNote },
        performedByAdminId: null, // set by the caller's audit log instead; this row is the durable ledger entry
      },
    }),
  ]);

  return updated;
}
