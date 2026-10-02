import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership, requireWorkshopMembership } from "@/lib/api/authorize";
import { apiError } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { assistantRequestSchema } from "@/lib/api/schemas";
import { buildGarageContext, buildWorkshopContext } from "@/lib/assistant/context";
import { AssistantNotConfiguredError, AssistantRefusedError, type AskInput } from "@/lib/assistant/claude";
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

export class AssistantRequestError extends Error {
  constructor(public response: Response) {
    super("Assistant request rejected.");
  }
}

/**
 * Shared by the plain and the streaming route: auth -> validate -> rate
 * limit -> membership -> context. Throws AssistantRequestError carrying the
 * HTTP response to send when the request can't go ahead.
 */
export async function prepareAssistant(req: NextRequest): Promise<AskInput> {
  const account = await requireAccount(req);

  const body = await req.json().catch(() => null);
  const parsed = assistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AssistantRequestError(apiError(422, "VALIDATION_ERROR", "Invalid assistant request.", parsed.error.flatten()));
  }
  const input = parsed.data;

  if (overLimit(account.id)) {
    throw new AssistantRequestError(apiError(429, "RATE_LIMITED", "Too many questions in a short time. Try again in a few minutes."));
  }

  const today = new Date();
  let context: string;
  let selectedVehicle: string | null = null;
  let focusJob: string | null = null;

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
    if (input.jobId) {
      const job = await prisma.job.findFirst({
        where: { id: input.jobId, workshopId: input.workshopId! },
        include: { customer: true },
      });
      if (!job) throw new NotFoundError("Job not found for this workshop.");
      focusJob = `${job.id} · ${job.customer.name} · ${job.vehicleDescription ?? "vehicle"} · status ${job.status}`;
    }
  }

  return {
    mode: input.mode,
    context,
    question: input.question,
    history: input.history,
    currency: currencyForRegion(account.region),
    distanceUnit: account.region === "US" || account.region === "GB" ? "mi" : "km",
    today: today.toISOString().slice(0, 10),
    selectedVehicle,
    focusJob,
  };
}

/** Maps a failure to the API's { error: { code, message } } shape. */
export function assistantError(error: unknown): { status: number; code: string; message: string } | null {
  if (error instanceof AssistantNotConfiguredError) return { status: 503, code: "AI_NOT_CONFIGURED", message: error.message };
  if (error instanceof AssistantRefusedError) return { status: 422, code: "AI_REFUSED", message: error.message };
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 503, code: "AI_BUSY", message: "The assistant is busy right now. Try again in a moment." };
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error("Assistant credentials rejected:", error.message);
    return { status: 503, code: "AI_NOT_CONFIGURED", message: "The assistant's API key was rejected." };
  }
  if (error instanceof Anthropic.APIError || error instanceof Anthropic.APIConnectionError) {
    console.error("Assistant upstream error:", error.message);
    return { status: 502, code: "AI_UNAVAILABLE", message: "The assistant could not answer right now." };
  }
  return null;
}

export function assistantErrorResponse(error: unknown): Response {
  if (error instanceof AssistantRequestError) return error.response;
  const mapped = assistantError(error);
  if (mapped) return apiError(mapped.status, mapped.code, mapped.message);
  return handleApiError(error);
}
