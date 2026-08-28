"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/session";
import { writeAdminAuditLog } from "@/lib/audit";

/** AUD-05: force sign-out of one of the current admin's own sessions. */
export async function forceSignOutSession(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const sessionId = String(formData.get("sessionId") || "");
  const row = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  if (!row || row.adminUserId !== admin.adminId) return; // never let an admin revoke someone else's session from this self-service page

  await prisma.adminSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedReason: "force_signout" },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "admin.session.force_signout",
      entityType: "AdminSession",
      entityId: sessionId,
      metadata: { self: true },
    },
  );

  revalidatePath("/security");
}

export async function getMySessions() {
  const admin = await requireAdmin();
  const current = await getSession();
  const sessions = await prisma.adminSession.findMany({
    where: { adminUserId: admin.adminId },
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });
  return { sessions, currentSessionId: current?.sessionId };
}
