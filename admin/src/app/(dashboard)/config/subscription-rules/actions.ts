"use server";

import { revalidatePath } from "next/cache";
import { ConfigObjectType } from "@/generated/prisma/enums";
import { stageDraft } from "@/lib/config/versioning";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const GLOBAL_KEY = "global";

export async function stageSubscriptionRulesDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const trialDays = Number(formData.get("trialDays"));
  const graceDays = Number(formData.get("graceDays"));
  const dunningScheduleDaysRaw = String(formData.get("dunningScheduleDays") || "").trim();
  const defaultSeatLimitRaw = String(formData.get("defaultSeatLimit") || "").trim();
  const note = String(formData.get("note") || "").trim() || undefined;

  if (!Number.isInteger(trialDays) || trialDays < 0) return { error: "Trial days must be a non-negative whole number." };
  if (!Number.isInteger(graceDays) || graceDays < 0) return { error: "Grace days must be a non-negative whole number." };

  const dunningScheduleDays = dunningScheduleDaysRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (dunningScheduleDays.some((n) => !Number.isInteger(n) || n < 0)) {
    return { error: "Dunning schedule must be a comma-separated list of non-negative whole numbers (e.g. 1,3,7)." };
  }

  let defaultSeatLimit: number | null = null;
  if (defaultSeatLimitRaw) {
    defaultSeatLimit = Number(defaultSeatLimitRaw);
    if (!Number.isInteger(defaultSeatLimit) || defaultSeatLimit < 1) {
      return { error: "Default seat limit must be a positive whole number, or left blank for unlimited." };
    }
  }

  await stageDraft({
    objectType: ConfigObjectType.SUBSCRIPTION_RULES,
    objectKey: GLOBAL_KEY,
    payload: { trialDays, graceDays, dunningScheduleDays, defaultSeatLimit },
    note,
  });

  revalidatePath("/config/subscription-rules");
  return { ok: true, message: "Draft staged." };
}
