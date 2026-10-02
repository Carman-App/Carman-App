import { apiError } from "@/lib/api/response";
import { PlanLimitExceededError } from "@/lib/limits";
import { InvalidJobTransitionError } from "@/lib/jobs/state-machine";

/**
 * Central error -> HTTP mapping for every /api/v1/* route, so the JSON error
 * shape (see response.ts) is identical no matter which route threw. Route
 * handlers should wrap their body in try/catch and `return handleApiError(error)`.
 *
 * UnauthorizedError/ForbiddenError live here (not in api/auth.ts, which
 * re-exports them for backward compatibility) specifically so this module
 * has no dependency on api/auth.ts's "server-only" import — src/lib/queue,
 * idempotency.ts, and rateLimit.ts import RateLimitedError from here and are
 * also loaded by scripts/queue-worker.ts, a plain Node/tsx script outside
 * Next.js's server-component boundary where "server-only" throws.
 */

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not allowed to access this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

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

export class RateLimitedError extends Error {
  retryAfterSeconds?: number;
  constructor(message = "Too many requests. Please slow down.", retryAfterSeconds?: number) {
    super(message);
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
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
    if (error.retryAfterSeconds != null) {
      res.headers.set("Retry-After", String(error.retryAfterSeconds));
    }
    return res;
  }
  console.error(error);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong.");
}
