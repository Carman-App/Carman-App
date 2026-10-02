"use server";

import { revalidatePath } from "next/cache";
import { revertToVersion, discardDraft } from "@/lib/config/versioning";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_PUBLISH_ROLES } from "@/lib/auth/rbac";
import { findPendingApproval, requestApproval } from "@/lib/approvals";
import { ConfigVersionStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

/**
 * Generic publish/revert/discard server actions shared by every CFG-06/07
 * versioned surface (Country, FeatureFlag, SubscriptionRules today) — the
 * actual role check and mutation live in src/lib/config/versioning.ts;
 * these just adapt its functions to the useActionState form contract used
 * throughout this console.
 */

export async function publishDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_PUBLISH_ROLES);
  const versionId = String(formData.get("versionId") || "");
  const note = String(formData.get("note") || "").trim();
  const revalidate = String(formData.get("revalidate") || "");
  if (!note) return { error: "A reason is required to publish." };

  const version = await prisma.configVersion.findUnique({ where: { id: versionId } });
  if (!version) return { error: "Draft not found." };
  if (version.status !== ConfigVersionStatus.DRAFT) return { error: `This version is already ${version.status.toLowerCase()}.` };
  if (await findPendingApproval("config.publish", versionId)) return { error: "This draft is already waiting for a second admin." };

  // AUD-03: publishing config needs a second admin. The draft goes live when
  // a different admin approves it in Approvals.
  await requestApproval(admin, {
    action: "config.publish",
    entityType: "ConfigVersion",
    entityId: versionId,
    payload: { versionId, note, revalidate },
    reason: note,
  });
  if (revalidate) revalidatePath(revalidate);
  return { ok: true, message: "Publish requested. It goes live when a second admin approves it in Approvals." };
}

export async function revertToVersionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const versionId = String(formData.get("versionId") || "");
  const note = String(formData.get("note") || "").trim();
  const revalidate = String(formData.get("revalidate") || "");
  if (!note) return { error: "A reason is required to revert." };

  try {
    await revertToVersion({ versionId, note });
    if (revalidate) revalidatePath(revalidate);
    return { ok: true, message: "Reverted — this is now the live, published version." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function discardDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const versionId = String(formData.get("versionId") || "");
  const revalidate = String(formData.get("revalidate") || "");

  try {
    await discardDraft(versionId);
    if (revalidate) revalidatePath(revalidate);
    return { ok: true, message: "Draft discarded." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
