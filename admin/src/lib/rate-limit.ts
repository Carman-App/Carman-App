import "server-only";
import type { NextRequest } from "next/server";
import { incrementWindow, incrementWindows } from "@/lib/redis";

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

const envMax = (name: string, fallback: number) => Number(process.env[`RATE_LIMIT_${name}`]) || fallback;

/** Defaults below; each can be overridden with RATE_LIMIT_<NAME> (e.g. RATE_LIMIT_API=1200). */
export const LIMITS = {
  /** Every authenticated API call, per account per minute. Generous: a busy screen makes a handful of calls. */
  api: { name: "api", max: envMax("API", 600), windowSeconds: 60 },
  /** Writes (POST/PATCH/DELETE), per account per minute. */
  write: { name: "write", max: envMax("WRITE", 120), windowSeconds: 60 },
  /** Sign-in and token refresh, per client IP per 5 minutes — slows down credential stuffing and token guessing. */
  auth: { name: "auth", max: envMax("AUTH", 30), windowSeconds: 300 },
  /** Calls with no valid identity, per IP per minute. */
  anonymous: { name: "anon", max: envMax("ANON", 120), windowSeconds: 60 },
} satisfies Record<string, Limit>;

export function clientIp(req: NextRequest): string {
  // Behind the platform's load balancer the left-most X-Forwarded-For entry is the client.
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

const windowKey = (limit: Limit, subject: string) => `rl:${limit.name}:${subject}:${Math.floor(Date.now() / 1000 / limit.windowSeconds)}`;

function tooMany(limit: Limit): RateLimitedError {
  const retry = limit.windowSeconds - (Math.floor(Date.now() / 1000) % limit.windowSeconds);
  return new RateLimitedError("Too many requests. Wait a moment and try again.", retry);
}

/** Throws RateLimitedError when `subject` has used up `limit` in the current window. */
export async function enforceLimit(limit: Limit, subject: string): Promise<void> {
  const count = await incrementWindow(windowKey(limit, subject), limit.windowSeconds);
  if (count > limit.max) throw tooMany(limit);
}

/** Several limits for one subject, counted in a single Redis round trip. */
export async function enforceLimits(limits: Limit[], subject: string): Promise<void> {
  const counts = await incrementWindows(limits.map((l) => ({ key: windowKey(l, subject), ttlSeconds: l.windowSeconds })));
  limits.forEach((l, i) => {
    if (counts[i] > l.max) throw tooMany(l);
  });
}
