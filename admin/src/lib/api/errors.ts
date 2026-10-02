import { apiError } from "@/lib/api/response";
import { UnauthorizedError, ForbiddenError } from "@/lib/api/auth";
import { PlanLimitExceededError } from "@/lib/limits";
import { InvalidJobTransitionError } from "@/lib/jobs/state-machine";
import { RateLimitedError } from "@/lib/rate-limit";
import { SignInError } from "@/lib/auth/end-user";

/**
 * Central error -> HTTP mapping for every /api/v1/* route, so the JSON error
 * shape (see response.ts) is identical no matter which route threw. Route
 * handlers should wrap their body in try/catch and `return handleApiError(error)`.
 */

export class NotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return apiError(401, "UNAUTHORIZED", error.message);
  }
  if (error instanceof ForbiddenError) {
    return apiError(403, "FORBIDDEN", error.message);
  }
  if (error instanceof NotFoundError) {
    return apiError(404, "NOT_FOUND", error.message);
  }
  if (error instanceof ConflictError) {
    return apiError(409, "CONFLICT", error.message);
  }
  if (error instanceof PlanLimitExceededError) {
    return apiError(402, "PLAN_LIMIT_EXCEEDED", error.message);
  }
  if (error instanceof InvalidJobTransitionError) {
    return apiError(409, "INVALID_TRANSITION", error.message);
  }
  if (error instanceof RateLimitedError) {
    const res = apiError(429, "RATE_LIMITED", error.message);
    res.headers.set("Retry-After", String(error.retryAfterSeconds));
    return res;
  }
  if (error instanceof SignInError) {
    return apiError(error.status, error.status === 503 ? "NOT_CONFIGURED" : "SIGN_IN_FAILED", error.message);
  }
  console.error(error);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong.");
}
