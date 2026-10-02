import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { askClaude } from "@/lib/assistant/claude";
import { assistantErrorResponse, prepareAssistant } from "@/lib/assistant/request";
import { cachedAnswer, recordUse, storeAnswer } from "@/lib/assistant/quota";

// POST /api/v1/assistant — answer a question about the caller's own garage
// (owner mode) or workshop (mechanic mode), optionally drafting a record or
// estimate lines. Returns the whole reply at once; see ./stream for the
// word-by-word variant the app uses.
export async function POST(req: NextRequest) {
  try {
    const { input, quota, cacheKey } = await prepareAssistant(req);
    const hit = await cachedAnswer(cacheKey);
    if (hit) return apiOk(hit);
    const reply = await askClaude(input);
    await Promise.all([recordUse(quota), storeAnswer(cacheKey, reply)]);
    return apiOk(reply);
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
