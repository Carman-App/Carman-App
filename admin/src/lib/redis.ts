import "server-only";
import Redis from "ioredis";

/**
 * Shared Redis for everything that must hold across server instances:
 * rate limits, short-lived caches, once-per-window flags and the job queue.
 *
 * REDIS_URL unset (local development): an in-process fallback with the
 * same semantics is used, which is correct for a single server only. In
 * production REDIS_URL is required — see DEPLOY.md.
 */

const globalForRedis = globalThis as unknown as { carmaRedis?: Redis | null };

export function getRedis(): Redis | null {
  if (globalForRedis.carmaRedis !== undefined) return globalForRedis.carmaRedis;
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") console.warn("[redis] REDIS_URL is not set; using per-instance memory. Rate limits will not hold across instances.");
    globalForRedis.carmaRedis = null;
    return null;
  }
  const client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
  client.on("error", (err) => console.error("[redis]", err.message));
  globalForRedis.carmaRedis = client;
  return client;
}

// ---------------------------------------------------------------------------
// In-memory fallback (single instance)
// ---------------------------------------------------------------------------

type Entry = { value: string; expiresAt: number };
const memory = new Map<string, Entry>();

function memGet(key: string): string | null {
  const e = memory.get(key);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return e.value;
}

function memSweep() {
  if (memory.size < 50_000) return;
  const now = Date.now();
  for (const [k, e] of memory) if (e.expiresAt < now) memory.delete(k);
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Increments a counter that expires `ttlSeconds` after it was created. Returns the new value. */
export async function incrementWindow(key: string, ttlSeconds: number): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      const [[, count]] = (await redis.multi().incr(key).expire(key, ttlSeconds, "NX").exec()) as [[unknown, number]];
      return count;
    } catch {
      // Redis briefly unavailable: fail open on counting rather than taking the API down.
      return 0;
    }
  }
  memSweep();
  const current = memGet(key);
  const next = (current ? Number(current) : 0) + 1;
  const expiresAt = current ? memory.get(key)!.expiresAt : Date.now() + ttlSeconds * 1000;
  memory.set(key, { value: String(next), expiresAt });
  return next;
}

/** Sets a flag if it is not set. Returns true the first time inside each window. */
export async function setOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      return (await redis.set(key, "1", "EX", ttlSeconds, "NX")) === "OK";
    } catch {
      return false;
    }
  }
  memSweep();
  if (memGet(key)) return false;
  memory.set(key, { value: "1", expiresAt: Date.now() + ttlSeconds * 1000 });
  return true;
}

/** Read-through cache for JSON-serialisable values. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch {
      return load();
    }
    const value = await load();
    redis.set(key, JSON.stringify(value), "EX", ttlSeconds).catch(() => {});
    return value;
  }
  const hit = memGet(key);
  if (hit !== null) return JSON.parse(hit) as T;
  const value = await load();
  memSweep();
  memory.set(key, { value: JSON.stringify(value), expiresAt: Date.now() + ttlSeconds * 1000 });
  return value;
}

export async function invalidate(...keys: string[]): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(...keys).catch(() => {});
    return;
  }
  for (const k of keys) memory.delete(k);
}
