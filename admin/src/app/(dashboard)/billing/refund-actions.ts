"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, MONEY_REFUND_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { requestApproval, approveAndExecute, rejectApproval, ApprovalError } from "@/lib/approvals";
import { RefundCreditType, RefundCreditStatus } from "@/generated/prisma/enums";
import { getFxRateMap } from "@/lib/money/fx";
import { currencyForSubscription } from "@/lib/money/currency";
import { refundNeedsApproval, executeRefundCredit } from "@/lib/money/refunds";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// MON-07 — request a refund/credit. Below the threshold (src/lib/money/refunds.ts)
// a single MONEY_REFUND_ROLES admin + required reason executes immediately
// (still a documented no-op — no processor exists). At/above threshold, this
// only creates the RefundCredit + TwoPersonApproval request; a *different*
// admin must approve before anything "executes" (see approveRefund below).
export async function requestRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MONEY_REFUND_ROLES);
  const subscriptionId = String(formData.get("subscriptionId") || "");
  const type = String(formData.get("type") || "");
  const amountDollars = Number(formData.get("amount"));
  const full = formData.get("full") === "on";
  const reason = String(formData.get("reason") || "").trim();

  if (!subscriptionId) return { error: "Pick a subscription." };
  if (type !== RefundCreditType.REFUND && type !== RefundCreditType.CREDIT) return { error: "Pick refund or credit." };
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) return { error: "Enter an amount greater than zero." };
  if (!reason) return { error: "A reason is required to request a refund or credit." };

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, account: { include: { user: true } }, workshop: { include: { owner: { include: { user: true } } } } },
  });
  if (!subscription) return { error: "Subscription not found." };

  const currency = currencyForSubscription(subscription);
  const amountCents = Math.round(amountDollars * 100);
  const accountId = subscription.accountId ?? subscription.workshop?.ownerId ?? null;
  const partyName = subscription.account?.user.name ?? subscription.workshop?.owner.user.name ?? subscription.workshop?.name ?? "this account";
  const partyEmail = subscription.account?.user.email ?? subscription.workshop?.owner.user.email ?? null;

  const refundCredit = await prisma.refundCredit.create({
    data: {
      subscriptionId,
      type: type as RefundCreditType,
      amountCents,
      currency,
      full,
      reason,
      requestedByAdminId: admin.adminId,
    },
  });

  const rates = await getFxRateMap();
  const { needsApproval, reasonLabel } = refundNeedsApproval(
    { amountCents, currency, planPriceCents: subscription.plan.priceCents },
    rates,
  );

  const amountLabel = `${(amountCents / 100).toFixed(2)} ${currency}`;
  const partyLabel = partyEmail ? `${partyName} (${partyEmail})` : partyName;

  if (needsApproval) {
    const approval = await requestApproval(admin, {
      action: "billing.refund",
      entityType: "RefundCredit",
      entityId: refundCredit.id,
      payload: { refundCreditId: refundCredit.id },
      reason: `${reason} [${amountLabel} ${type.toLowerCase()} to ${partyLabel} — ${reasonLabel}]`,
    });
    await prisma.refundCredit.update({ where: { id: refundCredit.id }, data: { approvalId: approval.id } });
    revalidatePath("/billing/refunds");
    return {
      ok: true,
      message: `Requested — ${amountLabel} ${type.toLowerCase()} to ${partyLabel} is ${reasonLabel}, so it needs a second FINANCE/OWNER admin to approve before anything is recorded as executed.`,
    };
  }

  try {
    await executeRefundCredit(refundCredit.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not execute this refund/credit." };
  }

  await writeAdminAuditLog(admin, {
    action: "billing.refund_execute",
    entityType: "RefundCredit",
    entityId: refundCredit.id,
    targetAccountId: accountId,
    reason,
    afterData: { amountCents, currency, type, full },
    metadata: { amountLabel, partyLabel },
  });

  revalidatePath("/billing/refunds");
  if (accountId) revalidatePath(`/accounts/${accountId}`);
  return {
    ok: true,
    message: `${amountLabel} ${type.toLowerCase()} to ${partyLabel} recorded — no payment processor is connected, so no real money moved; this records the admin decision only.`,
  };
}

export async function approveRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MONEY_REFUND_ROLES);
  const approvalId = String(formData.get("approvalId") || "");

  let accountId: string | null = null;
  try {
    await approveAndExecute(admin, approvalId, async (payload) => {
      const p = payload as { refundCreditId: string };
      const result = await executeRefundCredit(p.refundCreditId);
      const rc = await prisma.refundCredit.findUnique({
        where: { id: p.refundCreditId },
        include: { subscription: { include: { workshop: { select: { ownerId: true } } } } },
      });
      accountId = rc?.subscription.accountId ?? rc?.subscription.workshop?.ownerId ?? null;
      return result;
    });
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not approve this refund/credit." };
  }

  revalidatePath("/billing/refunds");
  if (accountId) revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Approved and executed (recorded — no real processor charge exists to reverse)." };
}

export async function rejectRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MONEY_REFUND_ROLES);
  const approvalId = String(formData.get("approvalId") || "");
  const refundCreditId = String(formData.get("refundCreditId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to reject a refund/credit request." };

  try {
    await rejectApproval(admin, approvalId, reason);
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not reject this request." };
  }

  if (refundCreditId) {
    await prisma.refundCredit.update({ where: { id: refundCreditId }, data: { status: RefundCreditStatus.DENIED } });
  }

  revalidatePath("/billing/refunds");
  return { ok: true, message: "Refund/credit request rejected." };
}
