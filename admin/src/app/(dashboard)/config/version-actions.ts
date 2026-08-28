"use server";

import { revalidatePath } from "next/cache";
import { publishVersion, revertToVersion, discardDraft } from "@/lib/config/versioning";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

/**
 * Generic publish/revert/discard server actions shared by every CFG-06/07
 * versioned surface (Country, FeatureFlag, SubscriptionRules today) — the
 * actual role check and mutation live in src/lib/config/versioning.ts;
 * these just adapt its functions to the useActionState form contract used
 * throughout this console.
 */

export async function publishDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const versionId = String(formData.get("versionId") || "");
  const note = String(formData.get("note") || "").trim();
  const revalidate = String(formData.get("revalidate") || "");
  if (!note) return { error: "A reason is required to publish." };

  try {
    const { accountsTouchedCount } = await publishVersion({ versionId, note });
    if (revalidate) revalidatePath(revalidate);
    return {
      ok: true,
      message:
        accountsTouchedCount == null
          ? "Published."
          : `Published. Estimated accounts touched: ${accountsTouchedCount}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
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
