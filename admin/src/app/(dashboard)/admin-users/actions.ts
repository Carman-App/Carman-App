"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_MANAGEMENT_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { requestApproval, approveAndExecute, rejectApproval, ApprovalError } from "@/lib/approvals";
import { hashPassword } from "@/lib/auth/password";
import { AdminRole } from "@/generated/prisma/enums";

const VALID_ROLES = Object.values(AdminRole) as string[];

export type AdminFormState = { error?: string; ok?: boolean; message?: string } | undefined;

/** AUD-04: create a new admin account with an explicit role and a temporary password. */
export async function createAdminUser(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireRole(ADMIN_MANAGEMENT_ROLES);

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "");
  const password = String(formData.get("password") || "");

  if (!email || !name) return { error: "Name and email are required." };
  if (!VALID_ROLES.includes(role)) return { error: "Pick a valid role." };
  if (password.length < 8) return { error: "Temporary password must be at least 8 characters." };

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return { error: "An admin with that email already exists." };

  const passwordHash = await hashPassword(password);
  const created = await prisma.adminUser.create({
    data: { email, name, passwordHash, role: role as AdminRole },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "admin.user.create",
      entityType: "AdminUser",
      entityId: created.id,
      reason: `Created by ${admin.email}`,
      afterData: { email, name, role },
    },
  );

  revalidatePath("/admin-users");
  return { ok: true };
}

/**
 * AUD-04/AUD-03: change an existing admin's role — "every change itself
 * logged", and per AUD-03's cross-cutting rule, "Two-person approval
 * required for: ... role changes." This now requests approval instead of
 * writing the role directly — a *different* OWNER must approve (the same
 * mechanism already used for GAR-07/MON-07/account deletion, see
 * src/lib/approvals.ts) before anything is written.
 */
export async function requestRoleChange(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireRole(ADMIN_MANAGEMENT_ROLES);
  const targetId = String(formData.get("adminId") || "");
  const role = String(formData.get("role") || "");
  const reason = String(formData.get("reason") || "").trim();

  if (!VALID_ROLES.includes(role)) return { error: "Pick a valid role." };
  if (!reason) return { error: "A reason is required to request a role change." };

  const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
  if (!target) return { error: "Admin not found." };
  if (target.id === admin.adminId && role !== target.role) {
    // Not an explicit "cannot escape the audit log" case, but changing your
    // own role unsupervised is exactly the kind of self-approval the OWNER
    // row's "Cannot: approve their own two-person action" is guarding
    // against in spirit — require a *different* Owner to do this.
    return { error: "You cannot change your own role — a different Owner must request and approve this." };
  }
  if (target.role === role) return { error: "That's already this admin's role." };

  const existingPending = await prisma.twoPersonApproval.findFirst({
    where: { entityType: "AdminUser", entityId: targetId, action: "admin.user.role_change", status: "PENDING" },
  });
  if (existingPending) return { error: "A role-change request is already pending for this admin." };

  await requestApproval(admin, {
    action: "admin.user.role_change",
    entityType: "AdminUser",
    entityId: targetId,
    payload: { targetId, role },
    reason,
  });

  revalidatePath("/admin-users");
  return { ok: true, message: "Role change requested — needs a second OWNER-role admin to approve." };
}

export async function approveRoleChange(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireRole(ADMIN_MANAGEMENT_ROLES);
  const approvalId = String(formData.get("approvalId") || "");

  try {
    await approveAndExecute(admin, approvalId, async (payload) => {
      const p = payload as { targetId: string; role: string };
      const target = await prisma.adminUser.findUnique({ where: { id: p.targetId } });
      if (!target) throw new Error("Admin not found.");
      if (target.role === p.role) throw new Error("That's already this admin's role.");

      const updated = await prisma.adminUser.update({ where: { id: p.targetId }, data: { role: p.role as AdminRole } });

      // Domain-specific log carrying before/after, in addition to
      // approveAndExecute's own generic "admin.user.role_change.approve_and_execute" entry.
      await writeAdminAuditLog(admin, {
        action: "admin.user.role_change",
        entityType: "AdminUser",
        entityId: p.targetId,
        beforeData: { role: target.role },
        afterData: { role: p.role },
      });

      return updated;
    });
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not approve this role change." };
  }

  revalidatePath("/admin-users");
  return { ok: true, message: "Role changed." };
}

export async function rejectRoleChange(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await requireRole(ADMIN_MANAGEMENT_ROLES);
  const approvalId = String(formData.get("approvalId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to reject a role-change request." };

  try {
    await rejectApproval(admin, approvalId, reason);
  } catch (err) {
    if (err instanceof ApprovalError) return { error: err.message };
    return { error: err instanceof Error ? err.message : "Could not reject this request." };
  }

  revalidatePath("/admin-users");
  return { ok: true, message: "Role-change request rejected." };
}

/** AUD-04: disable/enable an admin account (kept, not deleted — the audit trail must stay intact). */
export async function toggleAdminDisabled(formData: FormData): Promise<void> {
  const admin = await requireRole(ADMIN_MANAGEMENT_ROLES);
  const targetId = String(formData.get("adminId") || "");
  if (targetId === admin.adminId) return; // can't disable yourself

  const target = await prisma.adminUser.findUnique({ where: { id: targetId } });
  if (!target) return;

  const nextDisabledAt = target.disabledAt ? null : new Date();
  await prisma.adminUser.update({ where: { id: targetId }, data: { disabledAt: nextDisabledAt } });

  if (nextDisabledAt) {
    // Disabling doesn't just block future logins — force out any live sessions now.
    await prisma.adminSession.updateMany({
      where: { adminUserId: targetId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "force_signout" },
    });
  }

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: nextDisabledAt ? "admin.user.disable" : "admin.user.enable",
      entityType: "AdminUser",
      entityId: targetId,
      beforeData: { disabledAt: target.disabledAt },
      afterData: { disabledAt: nextDisabledAt },
    },
  );

  revalidatePath("/admin-users");
}

/** OWNER can force-sign-out any admin's session (not just their own — see src/app/(dashboard)/security for self-service). */
export async function forceSignOutAnySession(formData: FormData): Promise<void> {
  const admin = await requireRole(ADMIN_MANAGEMENT_ROLES);
  const sessionId = String(formData.get("sessionId") || "");
  const row = await prisma.adminSession.findUnique({ where: { id: sessionId } });
  if (!row) return;

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
      metadata: { targetAdminUserId: row.adminUserId, self: false },
    },
  );

  revalidatePath("/admin-users");
}

