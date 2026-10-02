import "server-only";
import type { NextRequest } from "next/server";
import { incrementWindow } from "@/lib/redis";

/**
 * Fixed-window rate limits, counted in Redis so they hold across every
 * server instance (src/lib/redis.ts falls back to memory in development).
 */

export class RateLimitedError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

export type Limit = { name: string; max: number; windowSeconds: number };

export const LIMITS = {
  /** Every authenticated API call, per account. Generous: a busy screen makes a handful of calls. */
  api: { name: "api", max: 600, windowSeconds: 60 },
  /** Writes (POST/PATCH/DELETE), per account. */
  write: { name: "write", max: 120, windowSeconds: 60 },
  /** Sign-in and token refresh, per client IP — slows down credential stuffing and token guessing. */
  auth: { name: "auth", max: 30, windowSeconds: 300 },
  /** Calls with no valid identity, per IP. */
  anonymous: { name: "anon", max: 120, windowSeconds: 60 },
} satisfies Record<string, Limit>;

export function clientIp(req: NextRequest): string {
  // Behind the platform's load balancer the left-most X-Forwarded-For entry is the client.
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Throws RateLimitedError when `subject` has used up `limit` in the current window. */
export async function enforceLimit(limit: Limit, subject: string): Promise<void> {
  const windowStart = Math.floor(Date.now() / 1000 / limit.windowSeconds);
  const key = `rl:${limit.name}:${subject}:${windowStart}`;
  const count = await incrementWindow(key, limit.windowSeconds);
  if (count > limit.max) {
    const retry = limit.windowSeconds - (Math.floor(Date.now() / 1000) % limit.windowSeconds);
    throw new RateLimitedError("Too many requests. Wait a moment and try again.", retry);
  }
}
