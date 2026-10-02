import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

// GET /api/health — for the load balancer and container health checks.
// 200 when the database (and Redis, if configured) answer within 2 s; 503
// otherwise, so a broken instance is taken out of rotation. Reveals nothing
// beyond up/down per dependency.
export async function GET() {
  const checks: Record<string, "ok" | "down" | "not configured"> = {};
  await Promise.all([
    withTimeout(prisma.$queryRaw`SELECT 1`, 2000).then(
      () => (checks.database = "ok"),
      () => (checks.database = "down"),
    ),
    (async () => {
      const redis = getRedis();
      if (!redis) return void (checks.redis = "not configured");
      await withTimeout(redis.ping(), 2000).then(
        () => (checks.redis = "ok"),
        () => (checks.redis = "down"),
      );
    })(),
  ]);
  const healthy = !Object.values(checks).includes("down");
  return Response.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
