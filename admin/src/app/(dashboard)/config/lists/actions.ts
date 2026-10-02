"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

/**
 * CFG-03 launches direct-edit-only per AGENTS.md's explicit allowance
 * ("ConfigList ... can launch without full versioning ... direct edits
 * only, still audit-logged") — a list's items are simple enough, and
 * change often enough in small increments, that draft/diff/publish would
 * add friction without much safety benefit. Every write is still
 * CONFIG_ROLES-gated and audit-logged.
 */

export async function upsertListItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const listKey = String(formData.get("listKey") || "").trim();
  const itemId = String(formData.get("itemId") || "").trim() || null;
  const code = String(formData.get("code") || "").trim();
  const label = String(formData.get("label") || "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") || "0").trim();
  const isActive = formData.get("isActive") === "on";
  const metadataRaw = String(formData.get("metadata") || "").trim();

  if (!listKey) return { error: "Missing list key." };
  if (!code) return { error: "A code is required." };
  if (!label) return { error: "A label is required." };
  const sortOrder = Number(sortOrderRaw);
  if (!Number.isInteger(sortOrder)) return { error: "Sort order must be a whole number." };

  let metadata: Prisma.InputJsonValue | undefined;
  if (metadataRaw) {
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return { error: "Metadata must be valid JSON (or left blank)." };
    }
  }

  const list = await prisma.configList.findUnique({ where: { key: listKey } });
  if (!list) return { error: "List not found." };

  const before = itemId ? await prisma.configListItem.findUnique({ where: { id: itemId } }) : null;

  const item = itemId
    ? await prisma.configListItem.update({
        where: { id: itemId },
        data: { code, label, sortOrder, isActive, metadata, updatedByAdminId: admin.adminId },
      })
    : await prisma.configListItem.create({
        data: { listId: list.id, code, label, sortOrder, isActive, metadata, updatedByAdminId: admin.adminId },
      });

  await writeAdminAuditLog(admin, {
    action: itemId ? "config.list_item_update" : "config.list_item_create",
    entityType: "ConfigListItem",
    entityId: item.id,
    beforeData: before ? { code: before.code, label: before.label, sortOrder: before.sortOrder, isActive: before.isActive, metadata: before.metadata } : null,
    afterData: { listKey, code, label, sortOrder, isActive, metadata },
  });

  revalidatePath(`/config/lists/${listKey}`);
  return { ok: true, message: itemId ? "Item updated." : "Item added." };
}

/**
 * NOT-03 — "never delete data without a recoverable window and stated
 * reason": this used to hard-delete the row (`prisma.configListItem.delete`)
 * with no way back, even though the model already has an `isActive` flag
 * that exists for exactly this — hiding a list item from apps without
 * destroying it (mirroring CFG-01's Country.isLive live/hidden toggle).
 * Deactivating is fully recoverable via the same edit form's "Active"
 * checkbox; a hard delete wasn't. Fixed to deactivate instead — see
 * upsertListItem above for the reactivate path.
 */
export async function deleteListItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const itemId = String(formData.get("itemId") || "");
  const item = await prisma.configListItem.findUnique({ where: { id: itemId }, include: { list: true } });
  if (!item) return { error: "Item not found." };
  if (!item.isActive) return { error: "Already inactive." };

  await prisma.configListItem.update({
    where: { id: itemId },
    data: { isActive: false, updatedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(admin, {
    action: "config.list_item_deactivate",
    entityType: "ConfigListItem",
    entityId: itemId,
    beforeData: { listKey: item.list.key, code: item.code, label: item.label, isActive: true },
    afterData: { isActive: false },
    metadata: { note: "Deactivated, not deleted — recoverable via the edit form's Active checkbox." },
  });

  revalidatePath(`/config/lists/${item.list.key}`);
  return { ok: true, message: "Item deactivated." };
}
