"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { SubscriptionStatus, SubscriptionEventType } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// MON-08 — "extend a trial or grant a free period (time-boxed, end date,
// reason, visible on account, expires itself)."
//
// "Expires itself" here means: this writes a real end date onto the real
// Subscription row (trialEndsAt or currentPeriodEnd) rather than a separate
// timer/flag — once that date passes, the extension is simply over because
// nothing keeps it going. Honesty note (stated in the UI too): no background
// job in this codebase currently transitions `status` automatically when
// trialEndsAt/currentPeriodEnd passes (there's no cron anywhere in this
// admin console) — the date is the real source of truth for support/billing
// conversations today, not an automatically-enforced cutoff.
export async function grantExtension(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(BILLING_ROLES);
  const subscriptionId = String(formData.get("subscriptionId") || "");
  const kind = String(formData.get("kind") || "");
  const endDateStr = String(formData.get("endDate") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!subscriptionId) return { error: "Pick a subscription." };
  if (kind !== "TRIAL_EXTENSION" && kind !== "FREE_PERIOD") return { error: "Pick trial extension or free period." };
  if (!endDateStr) return { error: "Pick an end date." };
  if (!reason) return { error: "A reason is required." };

  const endDate = new Date(`${endDateStr}T23:59:59.999Z`);
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= Date.now()) {
    return { error: "End date must be in the future." };
  }

  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) return { error: "Subscription not found." };

  const accountId = subscription.accountId ?? (await prisma.workshop.findUnique({ where: { id: subscription.workshopId ?? "" }, select: { ownerId: true } }))?.ownerId ?? null;

  if (kind === "TRIAL_EXTENSION") {
    if (subscription.status !== SubscriptionStatus.TRIALING) {
      return { error: "Only a TRIALING subscription can have its trial extended." };
    }
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: subscriptionId }, data: { trialEndsAt: endDate } }),
      prisma.subscriptionEvent.create({
        data: {
          subscriptionId,
          type: SubscriptionEventType.TRIAL_EXTENDED,
          occurredAt: new Date(),
          note: reason,
          metadata: { extendedUntil: endDate.toISOString() },
          performedByAdminId: admin.adminId,
        },
      }),
    ]);
  } else {
    if (subscription.status === SubscriptionStatus.CANCELED) {
      return { error: "This subscription is cancelled — reactivate it first (record a new subscription/status change) before granting a free period." };
    }
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscriptionId },
        data: { currentPeriodEnd: endDate, status: SubscriptionStatus.ACTIVE, graceEndsAt: null },
      }),
      prisma.subscriptionEvent.create({
        data: {
          subscriptionId,
          type: SubscriptionEventType.FREE_PERIOD_GRANTED,
          amountCents: 0,
          occurredAt: new Date(),
          note: reason,
          metadata: { extendedUntil: endDate.toISOString() },
          performedByAdminId: admin.adminId,
        },
      }),
    ]);
  }

  await writeAdminAuditLog(admin, {
    action: kind === "TRIAL_EXTENSION" ? "billing.trial_extended" : "billing.free_period_granted",
    entityType: "Subscription",
    entityId: subscriptionId,
    targetAccountId: accountId,
    reason,
    afterData: { endDate: endDate.toISOString() },
  });

  revalidatePath("/billing/grant-free-period");
  if (accountId) revalidatePath(`/accounts/${accountId}`);
  return {
    ok: true,
    message: `${kind === "TRIAL_EXTENSION" ? "Trial extended" : "Free period granted"} until ${endDate.toDateString()}.`,
  };
}
