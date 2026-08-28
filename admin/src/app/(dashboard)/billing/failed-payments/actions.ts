"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// MON-03 — "action to request a new card." No payment processor is
// connected (see .env.example's reserved STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET),
// so there is no real channel to prompt a cardholder for a new card yet.
// This mirrors Phase One's resendVerificationCode/unlockAccount pattern
// exactly: record the operator's intent in the append-only audit log and say
// plainly that nothing was actually sent, rather than faking success.
export async function requestNewCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(BILLING_ROLES);
  const failedPaymentId = String(formData.get("failedPaymentId") || "");

  const failedPayment = await prisma.failedPayment.findUnique({
    where: { id: failedPaymentId },
    include: { subscription: true },
  });
  if (!failedPayment) return { error: "Failed payment not found." };

  await writeAdminAuditLog(admin, {
    action: "billing.request_new_card",
    entityType: "FailedPayment",
    entityId: failedPaymentId,
    targetAccountId: failedPayment.subscription.accountId,
    metadata: {
      note: "No payment processor is connected — this records operator intent only; wire to a real provider's card-update flow once one exists.",
      subscriptionId: failedPayment.subscriptionId,
    },
  });

  revalidatePath("/billing/failed-payments");
  return { ok: true, message: "Recorded — no live channel is wired up yet to actually request a new card." };
}
