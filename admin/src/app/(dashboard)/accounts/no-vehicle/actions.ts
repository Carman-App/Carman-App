"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ACCOUNT_QUICK_ACTION_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

/**
 * ACCT-04 "never chased twice" marker. Purely a bookkeeping flag — it does
 * not send anything (no email/SMS provider exists for this yet); it records
 * that an operator followed up so the same account isn't chased again by
 * someone else working the same list.
 */
export async function markChasedNoVehicle(formData: FormData): Promise<void> {
  const admin = await requireRole(ACCOUNT_QUICK_ACTION_ROLES);
  const accountId = String(formData.get("accountId") || "");
  if (!accountId) return;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.chasedNoVehicleAt) return; // already chased — don't overwrite the original chaser/time

  await prisma.account.update({
    where: { id: accountId },
    data: { chasedNoVehicleAt: new Date(), chasedNoVehicleByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.chase_no_vehicle_marked",
      entityType: "Account",
      entityId: accountId,
      targetAccountId: accountId,
    },
  );

  revalidatePath("/accounts/no-vehicle");
  revalidatePath(`/accounts/${accountId}`);
}
