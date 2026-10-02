import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership, requireWorkshopMembership } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { assistantRequestSchema } from "@/lib/api/schemas";
import { buildGarageContext, buildWorkshopContext } from "@/lib/assistant/context";
import { AssistantNotConfiguredError, AssistantRefusedError, askClaude } from "@/lib/assistant/claude";
import { currencyForRegion } from "@/lib/region";

// Each question is one model call over the caller's whole garage, so keep a
// per-account ceiling. In-memory is enough for one server instance; move it
// to a shared store if the API is scaled out.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const recent = new Map<string, number[]>();

function overLimit(accountId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(accountId) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(accountId, hits);
  return hits.length > MAX_PER_WINDOW;
}

// POST /api/v1/assistant — answer a question about the caller's own garage
// (owner mode) or workshop (mechanic mode), optionally drafting a record.
// Chain: auth -> account -> validate -> membership -> context -> Claude.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const body = await req.json().catch(() => null);
    const parsed = assistantRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid assistant request.", parsed.error.flatten());
    }
    const input = parsed.data;

    if (overLimit(account.id)) {
      return apiError(429, "RATE_LIMITED", "Too many questions in a short time. Try again in a few minutes.");
    }

    let context: string;
    let selectedVehicle: string | null = null;
    const today = new Date();

    if (input.mode === "owner") {
      await requireGarageMembership(account.id, input.garageId!);
      context = await buildGarageContext(input.garageId!, today);
      if (input.vehicleId) {
        const v = await prisma.vehicle.findFirst({
          where: { id: input.vehicleId, garageId: input.garageId! },
          select: { id: true, make: true, model: true },
        });
        if (v) selectedVehicle = `${v.make} ${v.model} (id ${v.id})`;
      }
    } else {
      await requireWorkshopMembership(account.id, input.workshopId!);
      context = await buildWorkshopContext(input.workshopId!);
    }

    const reply = await askClaude({
      mode: input.mode,
      context,
      question: input.question,
      history: input.history,
      currency: currencyForRegion(account.region),
      distanceUnit: account.region === "US" || account.region === "GB" ? "mi" : "km",
      today: today.toISOString().slice(0, 10),
      selectedVehicle,
    });

    return apiOk(reply);
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      return apiError(503, "AI_NOT_CONFIGURED", error.message);
    }
    if (error instanceof AssistantRefusedError) {
      return apiError(422, "AI_REFUSED", error.message);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return apiError(503, "AI_BUSY", "The assistant is busy right now. Try again in a moment.");
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error("Assistant credentials rejected:", error.message);
      return apiError(503, "AI_NOT_CONFIGURED", "The assistant's API key was rejected.");
    }
    if (error instanceof Anthropic.APIError || error instanceof Anthropic.APIConnectionError) {
      console.error("Assistant upstream error:", error.message);
      return apiError(502, "AI_UNAVAILABLE", "The assistant could not answer right now.");
    }
    return handleApiError(error);
  }
}
