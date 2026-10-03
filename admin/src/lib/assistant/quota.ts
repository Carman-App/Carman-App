import "server-only";
import { createHash } from "crypto";
import { getPlanState } from "@/lib/limits";
import { getJson, incrementWindow, setJson } from "@/lib/redis";
import { PlanSubject } from "@/generated/prisma/enums";
import type { AssistantReply, AskInput } from "@/lib/assistant/claude";

/**
 * AI cost controls.
 * 1. A monthly question quota per plan (Plan.assistantMonthlyQuota), counted
 *    per account (owner side) or per workshop (mechanic side) in Redis.
 * 2. An answer cache: the same question over the same records, the same
 *    day, is answered from the cache for 10 minutes without a model call and
 *    without counting against the quota. Follow-up turns (with history) are
 *    never cached. The cache key includes a hash of the records snapshot, so
 *    any change to the data asks the model again.
 */

export class AssistantQuotaError extends Error {
  constructor(
    message: string,
    public readonly limit: number,
  ) {
    super(message);
    this.name = "AssistantQuotaError";
  }
}

export type QuotaSubject = { subject: PlanSubject; id: string };

const monthKey = (s: QuotaSubject) => {
  const d = new Date();
  return `ai:used:${s.subject}:${s.id}:${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Questions used so far this calendar month (UTC), for the console. */
export async function usedThisMonth(s: QuotaSubject): Promise<number> {
  return Number((await getJson<number>(monthKey(s))) ?? 0);
}

/** Throws AssistantQuotaError when this month's questions are used up. */
export async function checkQuota(s: QuotaSubject): Promise<void> {
  const plan = await getPlanState(s.subject, s.id);
  const limit = plan?.plan.assistantMonthlyQuota;
  if (limit == null) return;
  const used = await usedThisMonth(s);
  if (used >= limit) {
    throw new AssistantQuotaError(
      `You have used this month's ${limit} assistant questions on the ${plan!.plan.name} plan. Everything else in Carma keeps working; questions reset on the 1st.`,
      limit,
    );
  }
}

/** Counts one answered question. Called only after the model answered. */
export async function recordUse(s: QuotaSubject): Promise<void> {
  await incrementWindow(monthKey(s), 35 * 86_400);
}

export function answerCacheKey(input: AskInput, quota: QuotaSubject): string | null {
  if (input.history.length > 0) return null;
  const h = createHash("sha256")
    .update(JSON.stringify([quota.subject, quota.id, input.mode, input.today, input.selectedVehicle, input.focusJob, input.question.trim().toLowerCase(), input.context]))
    .digest("hex");
  return `ai:answer:${h}`;
}

const ANSWER_TTL_SECONDS = 600;

export async function cachedAnswer(key: string | null): Promise<AssistantReply | null> {
  return key ? getJson<AssistantReply>(key) : null;
}

export async function storeAnswer(key: string | null, reply: AssistantReply): Promise<void> {
  if (key) await setJson(key, reply, ANSWER_TTL_SECONDS);
}
