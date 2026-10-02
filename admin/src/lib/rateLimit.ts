// No "server-only" guard — see the comment in src/lib/queue/queue.ts. This
// module's sweep function is also called from scripts/queue-worker.ts.
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RateLimitedError } from "@/lib/api/errors";

/**
 * Postgres-backed fixed-window rate limiting (section 8 of AGENTS.md's
 * scalability pass). A genuine, correct implementation for a single-region
 * modular monolith — not a placeholder. The bucket key encodes the window
 * boundary directly (e.g. "login:ip:1.2.3.4:2026-08-31T12:05"), so
 * "increment or create the current window's counter" is one atomic upsert
 * with no separate rollover bookkeeping.
 *
 * Honest limitation vs. Redis (the Stage 2 upgrade): every check is a real
 * round-trip to Postgres (a few ms on Neon), and counters aren't shared
 * with sub-millisecond consistency across concurrently-racing requests the
 * way an atomic Redis INCR is — under heavy concurrent load against the
 * *same* bucket, two requests can both read "count was under the limit"
 * before either writes (the upsert below narrows but doesn't fully close
 * this window without a serializable transaction, which isn't worth paying
 * for at this scale). This is fine for auth/2FA/admin-API rate limiting
 * (bursts of a handful of requests per key, not thousands/sec against one
 * key) and becomes worth replacing once Next.js runs as more than one
 * instance and needs a single shared, sub-ms-consistent counter — see
 * SCALABILITY_AUDIT.md.
 */

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

export type RateLimitRule = {
  /** Logical name, e.g. "login", "twofactor.verify", "report.generate". */
  name: string;
  limit: number;
  windowSeconds: number;
};

/** Common rules named in AGENTS.md section 8 — tune here, not at call sites. */
export const RATE_LIMITS = {
  ADMIN_LOGIN: { name: "admin.login", limit: 10, windowSeconds: 60 } satisfies RateLimitRule,
  ADMIN_2FA_VERIFY: { name: "admin.2fa.verify", limit: 10, windowSeconds: 60 } satisfies RateLimitRule,
  REPORT_GENERATE: { name: "report.generate", limit: 20, windowSeconds: 3600 } satisfies RateLimitRule,
  DOCUMENT_UPLOAD: { name: "document.upload", limit: 60, windowSeconds: 3600 } satisfies RateLimitRule,
  MOBILE_MUTATION: { name: "mobile.mutation", limit: 120, windowSeconds: 60 } satisfies RateLimitRule,
} as const;

function windowKey(rule: RateLimitRule, identity: string, now: Date): { bucketKey: string; windowStart: Date; expiresAt: Date } {
  const windowMs = rule.windowSeconds * 1000;
  const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs);
  const bucketKey = `${rule.name}:${identity}:${windowStartMs}`;
  return { bucketKey, windowStart, expiresAt };
}

/**
 * Checks and increments a rate-limit bucket in one call. Returns whether the
 * request should be allowed — callers must still actually reject the
 * request (return 429) when `allowed` is false; this function never throws.
 */
export async function checkRateLimit(rule: RateLimitRule, identity: string): Promise<RateLimitResult> {
  const now = new Date();
  const { bucketKey, windowStart, expiresAt } = windowKey(rule, identity, now);

  // Atomic upsert: create the bucket at count=1 if it doesn't exist yet, or
  // increment it if it does — a single round trip, no read-then-write race
  // for the common case.
  const bucket = await prisma.rateLimitBucket.upsert({
    where: { bucketKey },
    create: { bucketKey, count: 1, windowStart, expiresAt },
    update: { count: { increment: 1 } },
  });

  return {
    allowed: bucket.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - bucket.count),
    resetAt: expiresAt,
  };
}

/** Convenience wrapper: throws RateLimitedError (mapped to HTTP 429) instead of returning a result to branch on. */
export async function enforceRateLimit(rule: RateLimitRule, identity: string): Promise<void> {
  const result = await checkRateLimit(rule, identity);
  if (!result.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
    throw new RateLimitedError(
      `Too many requests for "${rule.name}". Try again in ${retryAfterSeconds}s.`,
      retryAfterSeconds,
    );
  }
}

/** Best-effort client IP from standard proxy headers, falling back to "unknown" (never blocks the request). */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Opportunistic TTL cleanup, called from the queue worker's poll loop (see scripts/queue-worker.ts). */
export async function sweepExpiredRateLimitBuckets(): Promise<number> {
  const { count } = await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
