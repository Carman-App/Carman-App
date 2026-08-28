"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, ACCOUNT_DANGEROUS_ACTION_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";
import type { MovedRefs } from "@/lib/accounts/merge";

export type MergeFormState = { error?: string } | undefined;

/**
 * ACCT-08 confirm step. Everything the preview screen showed is re-read
 * inside one transaction (not trusted from the client) and reassigned from
 * secondary -> primary, watching for unique-constraint collisions on
 * GarageMember/VehicleMembership/WorkshopMember — a row that would collide
 * is left in place on the secondary account and recorded under
 * movedRefs.skipped rather than crashing the transaction.
 */
export async function confirmMerge(_prev: MergeFormState, formData: FormData): Promise<MergeFormState> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const primaryId = String(formData.get("primaryId") || "").trim();
  const secondaryId = String(formData.get("secondaryId") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!primaryId || !secondaryId) return { error: "Both account ids are required." };
  if (primaryId === secondaryId) return { error: "Pick two different accounts." };
  if (!reason) return { error: "A reason is required before merging." };

  const [primary, secondary] = await Promise.all([
    prisma.account.findUnique({ where: { id: primaryId } }),
    prisma.account.findUnique({ where: { id: secondaryId } }),
  ]);
  if (!primary) return { error: `No account found for primary id "${primaryId}".` };
  if (!secondary) return { error: `No account found for secondary id "${secondaryId}".` };
  if (primary.mergedIntoAccountId) return { error: "The primary account has itself already been merged." };
  if (secondary.mergedIntoAccountId) return { error: "That account has already been merged." };

  const { mergeRecordId, movedRefs } = await prisma.$transaction(async (tx) => {
    const [
      garages,
      garageMembers,
      vehicleMemberships,
      workshops,
      workshopMembers,
      subscriptions,
      notifications,
      primaryGarageMemberships,
      primaryWorkshopMemberships,
      primaryVehicleMemberships,
    ] = await Promise.all([
      tx.garage.findMany({ where: { ownerId: secondaryId }, select: { id: true } }),
      tx.garageMember.findMany({ where: { accountId: secondaryId }, select: { id: true, garageId: true } }),
      tx.vehicleMembership.findMany({ where: { accountId: secondaryId }, select: { id: true, vehicleId: true } }),
      tx.workshop.findMany({ where: { ownerId: secondaryId }, select: { id: true } }),
      tx.workshopMember.findMany({ where: { accountId: secondaryId }, select: { id: true, workshopId: true } }),
      tx.subscription.findMany({ where: { accountId: secondaryId }, select: { id: true } }),
      tx.notification.findMany({ where: { accountId: secondaryId }, select: { id: true } }),
      tx.garageMember.findMany({ where: { accountId: primaryId }, select: { garageId: true } }),
      tx.workshopMember.findMany({ where: { accountId: primaryId }, select: { workshopId: true } }),
      tx.vehicleMembership.findMany({ where: { accountId: primaryId }, select: { vehicleId: true } }),
    ]);

    const primaryGarageIds = new Set(primaryGarageMemberships.map((m) => m.garageId));
    const primaryWorkshopIds = new Set(primaryWorkshopMemberships.map((m) => m.workshopId));
    const primaryVehicleIds = new Set(primaryVehicleMemberships.map((m) => m.vehicleId));

    const movedGarageIds = garages.map((g) => g.id);
    if (movedGarageIds.length > 0) {
      await tx.garage.updateMany({ where: { id: { in: movedGarageIds } }, data: { ownerId: primaryId } });
    }

    const movedGarageMemberIds: string[] = [];
    const skippedGarageMemberIds: string[] = [];
    for (const gm of garageMembers) {
      if (primaryGarageIds.has(gm.garageId)) {
        skippedGarageMemberIds.push(gm.id);
        continue;
      }
      await tx.garageMember.update({ where: { id: gm.id }, data: { accountId: primaryId } });
      movedGarageMemberIds.push(gm.id);
    }

    const movedVehicleMembershipIds: string[] = [];
    const skippedVehicleMembershipIds: string[] = [];
    for (const vm of vehicleMemberships) {
      if (primaryVehicleIds.has(vm.vehicleId)) {
        skippedVehicleMembershipIds.push(vm.id);
        continue;
      }
      await tx.vehicleMembership.update({ where: { id: vm.id }, data: { accountId: primaryId } });
      movedVehicleMembershipIds.push(vm.id);
    }

    const movedWorkshopIds = workshops.map((w) => w.id);
    if (movedWorkshopIds.length > 0) {
      await tx.workshop.updateMany({ where: { id: { in: movedWorkshopIds } }, data: { ownerId: primaryId } });
    }

    const movedWorkshopMemberIds: string[] = [];
    const skippedWorkshopMemberIds: string[] = [];
    for (const wm of workshopMembers) {
      if (primaryWorkshopIds.has(wm.workshopId)) {
        skippedWorkshopMemberIds.push(wm.id);
        continue;
      }
      await tx.workshopMember.update({ where: { id: wm.id }, data: { accountId: primaryId } });
      movedWorkshopMemberIds.push(wm.id);
    }

    const movedSubscriptionIds = subscriptions.map((s) => s.id);
    if (movedSubscriptionIds.length > 0) {
      await tx.subscription.updateMany({ where: { id: { in: movedSubscriptionIds } }, data: { accountId: primaryId } });
    }

    const movedNotificationIds = notifications.map((n) => n.id);
    if (movedNotificationIds.length > 0) {
      await tx.notification.updateMany({ where: { id: { in: movedNotificationIds } }, data: { accountId: primaryId } });
    }

    await tx.account.update({ where: { id: secondaryId }, data: { mergedIntoAccountId: primaryId } });

    const movedRefs: MovedRefs = {
      garageIds: movedGarageIds,
      garageMemberIds: movedGarageMemberIds,
      vehicleMembershipIds: movedVehicleMembershipIds,
      workshopIds: movedWorkshopIds,
      workshopMemberIds: movedWorkshopMemberIds,
      subscriptionIds: movedSubscriptionIds,
      notificationIds: movedNotificationIds,
      skipped: {
        garageMemberIds: skippedGarageMemberIds,
        vehicleMembershipIds: skippedVehicleMembershipIds,
        workshopMemberIds: skippedWorkshopMemberIds,
      },
    };

    const mergeRecord = await tx.accountMerge.create({
      data: {
        primaryAccountId: primaryId,
        secondaryAccountId: secondaryId,
        movedRefs: movedRefs as unknown as Prisma.InputJsonValue,
        reason,
        performedByAdminId: admin.adminId,
      },
    });

    return { mergeRecordId: mergeRecord.id, movedRefs };
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.merge",
      entityType: "AccountMerge",
      entityId: mergeRecordId,
      targetAccountId: primaryId,
      reason,
      metadata: { secondaryAccountId: secondaryId, movedRefs: movedRefs as unknown as Record<string, unknown> },
    },
  );

  revalidatePath(`/accounts/${primaryId}`);
  revalidatePath(`/accounts/${secondaryId}`);
  redirect(`/accounts/${primaryId}`);
}

/**
 * Undo, available indefinitely (no time limit, unlike the 30-day
 * delete-restore window) — moves exactly the ids recorded in movedRefs back
 * to the secondary account and clears mergedIntoAccountId.
 */
export async function undoMerge(formData: FormData): Promise<void> {
  const admin = await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const mergeId = String(formData.get("mergeId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!mergeId) return;

  const merge = await prisma.accountMerge.findUnique({ where: { id: mergeId } });
  if (!merge || merge.revertedAt) return;

  const refs = merge.movedRefs as unknown as MovedRefs;

  await prisma.$transaction(async (tx) => {
    if (refs.garageIds.length > 0) {
      await tx.garage.updateMany({ where: { id: { in: refs.garageIds } }, data: { ownerId: merge.secondaryAccountId } });
    }
    if (refs.garageMemberIds.length > 0) {
      await tx.garageMember.updateMany({
        where: { id: { in: refs.garageMemberIds } },
        data: { accountId: merge.secondaryAccountId },
      });
    }
    if (refs.vehicleMembershipIds.length > 0) {
      await tx.vehicleMembership.updateMany({
        where: { id: { in: refs.vehicleMembershipIds } },
        data: { accountId: merge.secondaryAccountId },
      });
    }
    if (refs.workshopIds.length > 0) {
      await tx.workshop.updateMany({ where: { id: { in: refs.workshopIds } }, data: { ownerId: merge.secondaryAccountId } });
    }
    if (refs.workshopMemberIds.length > 0) {
      await tx.workshopMember.updateMany({
        where: { id: { in: refs.workshopMemberIds } },
        data: { accountId: merge.secondaryAccountId },
      });
    }
    if (refs.subscriptionIds.length > 0) {
      await tx.subscription.updateMany({
        where: { id: { in: refs.subscriptionIds } },
        data: { accountId: merge.secondaryAccountId },
      });
    }
    if (refs.notificationIds.length > 0) {
      await tx.notification.updateMany({
        where: { id: { in: refs.notificationIds } },
        data: { accountId: merge.secondaryAccountId },
      });
    }

    await tx.account.update({ where: { id: merge.secondaryAccountId }, data: { mergedIntoAccountId: null } });
    await tx.accountMerge.update({
      where: { id: merge.id },
      data: { revertedAt: new Date(), revertedByAdminId: admin.adminId },
    });
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "account.merge.undo",
      entityType: "AccountMerge",
      entityId: merge.id,
      targetAccountId: merge.primaryAccountId,
      reason: reason || "Merge reverted.",
      metadata: { secondaryAccountId: merge.secondaryAccountId },
    },
  );

  revalidatePath(`/accounts/${merge.primaryAccountId}`);
  revalidatePath(`/accounts/${merge.secondaryAccountId}`);
}
