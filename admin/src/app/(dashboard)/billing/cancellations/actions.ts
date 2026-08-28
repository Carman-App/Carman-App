"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { CancellationReason, SubscriptionStatus, SubscriptionEventType } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const REASONS = Object.values(CancellationReason) as string[];

// MON-05 — records a cancellation an admin is actioning on a customer's
// behalf (e.g. they emailed support to cancel — there is no self-serve
// cancel flow yet). Writes both the real Subscription fields (status/
// cancelledAt/cancellationReason/cancellationNote) and a real
// SubscriptionEvent(type=CANCELLED) row, per this work's brief: "every real
// action you build ... must write a real event."
export async function cancelSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(BILLING_ROLES);
  const subscriptionId = String(formData.get("subscriptionId") || "");
  const reason = String(formData.get("cancellationReason") || "");
  const note = String(formData.get("note") || "").trim();

  if (!subscriptionId) return { error: "Pick a subscription to cancel." };
  if (!REASONS.includes(reason)) return { error: "Pick a cancellation reason from the list." };
  if (!note) return { error: "A note is required in addition to the reason." };

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!subscription) return { error: "Subscription not found." };
  if (subscription.status === SubscriptionStatus.CANCELED) return { error: "Already cancelled." };

  const now = new Date();
  const accountId = subscription.accountId;

  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELED,
        cancelledAt: now,
        cancellationReason: reason as CancellationReason,
        cancellationNote: note,
      },
    }),
    prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        type: SubscriptionEventType.CANCELLED,
        fromPlanId: subscription.planId,
        amountCents: subscription.plan.priceCents,
        occurredAt: now,
        note,
        metadata: { cancellationReason: reason },
        performedByAdminId: admin.adminId,
      },
    }),
  ]);

  await writeAdminAuditLog(admin, {
    action: "billing.cancel_subscription",
    entityType: "Subscription",
    entityId: subscriptionId,
    targetAccountId: accountId,
    reason: note,
    beforeData: { status: subscription.status, cancelledAt: subscription.cancelledAt },
    afterData: { status: "CANCELED", cancelledAt: now, cancellationReason: reason, cancellationNote: note },
  });

  revalidatePath("/billing/cancellations");
  revalidatePath("/billing");
  if (accountId) revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Subscription cancelled and recorded." };
}
