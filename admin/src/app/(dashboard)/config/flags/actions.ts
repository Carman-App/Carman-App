"use server";

import { revalidatePath } from "next/cache";
import { ConfigObjectType, Region } from "@/generated/prisma/enums";
import { stageDraft } from "@/lib/config/versioning";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const REGIONS = Object.values(Region) as string[];

export async function stageFlagDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const key = String(formData.get("key") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const isEnabled = formData.get("isEnabled") === "on";
  const targeting = String(formData.get("targeting") || "everyone");
  const accountIdsRaw = String(formData.get("accountIds") || "").trim();
  const countries = formData.getAll("countries").map(String);
  const cohort = String(formData.get("cohort") || "").trim();
  const note = String(formData.get("note") || "").trim() || undefined;

  if (!key) return { error: "A flag key is required." };
  if (!/^[a-z0-9_]+$/.test(key)) {
    return { error: "Key must be lowercase letters, numbers, and underscores only (a stable machine key)." };
  }

  let audience: { accountIds?: string[]; countries?: string[]; cohort?: string } | null = null;
  if (targeting === "accountIds") {
    const accountIds = accountIdsRaw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (accountIds.length === 0) return { error: "List at least one account id, or pick a different targeting mode." };
    audience = { accountIds };
  } else if (targeting === "countries") {
    const bad = countries.filter((c) => !REGIONS.includes(c));
    if (countries.length === 0) return { error: "Pick at least one region, or pick a different targeting mode." };
    if (bad.length > 0) return { error: "Invalid region selected." };
    audience = { countries };
  } else if (targeting === "cohort") {
    if (!cohort) return { error: "Name a cohort, or pick a different targeting mode." };
    audience = { cohort };
  }
  // targeting === "everyone" -> audience stays null

  await stageDraft({
    objectType: ConfigObjectType.FEATURE_FLAG,
    objectKey: key,
    payload: { key, description, isEnabled, audience },
    note,
  });

  revalidatePath(`/config/flags/${key}`);
  revalidatePath("/config/flags");
  return { ok: true, message: "Draft staged." };
}
