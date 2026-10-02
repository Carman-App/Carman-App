// No "server-only" guard — see the comment in src/lib/queue/queue.ts. This
// module's sweep function is also called from scripts/queue-worker.ts.
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { IdempotencyKeyStatus, type Prisma } from "@/generated/prisma/client";
import { ConflictError } from "@/lib/api/errors";

/**
 * Postgres-backed idempotency keys — makes critical mutations safe to retry
 * (section 7 of AGENTS.md's scalability pass): estimate approval/decline,
 * access grant/request actions, report generation. A retry with the same
 * key returns the original response instead of repeating the side effect
 * (double-approving an estimate, double-granting access, generating the
 * same report twice).
 *
 * A `RateLimitBucket`-style Redis lookup would be faster, but idempotency
 * keys need durability across a request that crashes mid-flight (Redis
 * alone can lose that if it's not also persisted) — Postgres is the
 * correct backing store for this even after Stage 2 introduces Redis for
 * rate limiting; only the *key generation/lookup latency* would improve
 * with a cache layer in front, not the durability guarantee itself.
 *
 * Usage: every route that should be retry-safe generates or accepts an
 * idempotency key, then wraps its mutation:
 *
 *   const key = req.headers.get("idempotency-key") ?? `auto:${account.id}:${estimateId}:${decision}`;
 *   const result = await withIdempotency({ scope: "estimate.decision", key, accountId: account.id, requestHash: hashRequest(body) },
 *     async () => { ...the actual mutation... return { status: 201, body: {...} }; });
 *   return apiOk(result.body, result.status);
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h — long enough to cover any realistic client retry window

export function hashRequest(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

/**
 * Resolves the idempotency key for a request: an explicit client-supplied
 * `Idempotency-Key` header if present, otherwise a derived key from
 * `fallbackSeed` (typically the mutated resource's id, e.g. an estimate or
 * access-request id). The derived fallback matters because most call sites
 * in this codebase are mobile requests that don't send the header yet — a
 * derived key still closes the double-submit/concurrent-retry race for
 * actions where the resource can only transition once (approve/decline,
 * revoke), since two requests racing to act on the *same resource* collide
 * on the same derived key regardless of client behavior.
 */
export function resolveIdempotencyKey(req: NextRequest, fallbackSeed: string): string {
  return req.headers.get("idempotency-key") ?? `auto:${fallbackSeed}`;
}

export type IdempotentResult<T> = { status: number; body: T };

export class IdempotencyInProgressError extends ConflictError {
  constructor() {
    super("An identical request is already being processed. Retry shortly.");
  }
}

/**
 * Runs `fn` at most once per (scope, key). Concurrent/retried calls with the
 * same key either:
 * - replay the stored response, if the original call already completed;
 * - throw IdempotencyInProgressError (mapped to 409), if the original call
 *   is still in flight — the caller should retry after a short backoff
 *   rather than have two copies of the mutation race each other;
 * - throw ConflictError, if the same key was reused with a materially
 *   different request body (a client bug, not a legitimate retry).
 *
 * On failure, the key is deleted so a genuinely failed request CAN be
 * retried with the same key (idempotency should never permanently wedge a
 * legitimate retry after a transient error).
 */
export async function withIdempotency<T>(
  opts: { scope: string; key: string; accountId?: string | null; requestHash?: string; ttlMs?: number },
  fn: () => Promise<IdempotentResult<T>>,
): Promise<IdempotentResult<T>> {
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS));

  let created: { id: string } | null = null;
  try {
    created = await prisma.idempotencyKey.create({
      data: {
        scope: opts.scope,
        key: opts.key,
        accountId: opts.accountId ?? undefined,
        requestHash: opts.requestHash,
        expiresAt,
      },
      select: { id: true },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    // A row for (scope, key) already exists — inspect it rather than
    // silently re-running the mutation.
    const existing = await prisma.idempotencyKey.findUnique({ where: { scope_key: { scope: opts.scope, key: opts.key } } });
    if (!existing) throw error; // deleted between the failed create and this read — extremely rare; caller may retry

    if (existing.requestHash && opts.requestHash && existing.requestHash !== opts.requestHash) {
      throw new ConflictError("This idempotency key was already used with a different request.");
    }

    if (existing.status === IdempotencyKeyStatus.IN_PROGRESS) {
      throw new IdempotencyInProgressError();
    }

    if (existing.status === IdempotencyKeyStatus.COMPLETED) {
      return { status: existing.responseStatus ?? 200, body: existing.responseBody as T };
    }

    // status === FAILED: the previous attempt errored and its key row was
    // already cleaned up in the catch block below in the normal case, but a
    // process crash between marking FAILED and deleting could leave one
    // behind — treat it as retryable by reclaiming the row.
    await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => {});
    return withIdempotency(opts, fn);
  }

  try {
    const result = await fn();
    await prisma.idempotencyKey.update({
      where: { id: created.id },
      data: {
        status: IdempotencyKeyStatus.COMPLETED,
        responseStatus: result.status,
        responseBody: result.body as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    // Delete (not mark FAILED-and-keep) so a genuine transient failure
    // never permanently blocks a legitimate retry with the same key.
    await prisma.idempotencyKey.delete({ where: { id: created.id } }).catch(() => {});
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Opportunistic TTL cleanup — called from the queue worker's poll loop
 * (see scripts/queue-worker.ts) rather than a cron job, since there is no
 * scheduler in this codebase yet. Safe to call as often as convenient.
 */
export async function sweepExpiredIdempotencyKeys(): Promise<number> {
  const { count } = await prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
