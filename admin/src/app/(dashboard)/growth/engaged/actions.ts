"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ACCOUNT_QUICK_ACTION_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

/**
 * GROW-08 "never chase twice" marker — mirrors ACCT-04's
 * markChasedNoVehicle exactly (src/app/(dashboard)/accounts/no-vehicle/actions.ts):
 * no reason required, purely a bookkeeping flag that nothing sends anything
 * itself (no email/SMS provider exists for this yet). Uses the separate
 * chasedEngagementAt/chasedEngagementByAdminId columns so this shortlist and
 * the no-vehicle list never share (or clobber) each other's marker.
 */
export async function markChasedEngagement(formData: FormData): Promise<void> {
  const admin = await requireRole(ACCOUNT_QUICK_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  if (!accountId) return;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.chasedEngagementAt) return; // already chased — don't overwrite the original chaser/time

  await prisma.account.update({
    where: { id: accountId },
    data: { chasedEngagementAt: new Date(), chasedEngagementByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.chase_engagement_marked",
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
    },
  );

  revalidatePath("/growth/engaged");
  revalidatePath(`/accounts/${accountId}`);
}
