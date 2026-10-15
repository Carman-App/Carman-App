import "server-only";
import type { PaginationMeta } from "@showrooms/shared";

const BASE = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/**
 * Anonymous, cacheable reads for server-rendered public pages. Never sends
 * user credentials, so cached responses can't leak private data.
 * Returns null on network failure so pages degrade instead of crashing builds.
 */
export async function publicGet<T>(path: string, revalidate = 60): Promise<{ data: T; meta?: PaginationMeta } | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate }, headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as { data: T; meta?: PaginationMeta };
  } catch {
    return null;
  }
}
