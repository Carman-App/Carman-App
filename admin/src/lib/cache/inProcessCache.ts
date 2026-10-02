/**
 * In-process TTL cache for high-read/low-change data (section 5 of
 * AGENTS.md's scalability pass) — FX rates, plan/config lookups, and
 * similar reference data that changes rarely (admin-edited) but is read on
 * a hot path (every billing dashboard render, every plan-limit check).
 *
 * This is intentionally per-instance memory, not a shared cache: today
 * there is exactly one Next.js server instance in dev, and a single-region
 * deployment of this modular monolith runs the same way at Stage 1. A
 * shared cache (Redis) only earns its keep once there's more than one
 * instance and they need to agree on cached values / invalidate together —
 * see SCALABILITY_AUDIT.md's Stage 2. Using Redis for this today would add
 * a network hop for no benefit a single instance's own memory doesn't
 * already give it.
 *
 * Invalidation strategy: every admin write path that changes cached data
 * MUST call `invalidate()` (or `invalidatePrefix()`) for the relevant
 * key(s) in the same action/route that performs the write — see call sites
 * in src/lib/money/fx.ts. There is no time-based-only caching of anything
 * that an admin action can change; TTL is a safety net (bounds staleness if
 * an invalidation call is ever missed), not the primary correctness
 * mechanism.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

/** Returns the cached value for `key` if present and unexpired, else undefined. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Read-through helper: returns the cached value, or computes+caches it via `fn`. */
export async function getOrSetCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;
  const value = await fn();
  cacheSet(key, value, ttlMs);
  return value;
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** For tests/ops visibility only. */
export function cacheSize(): number {
  return store.size;
}
