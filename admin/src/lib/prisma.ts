import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter for SQL datasources — see
// prisma/schema.prisma and prisma.config.ts. DATABASE_URL is read lazily
// (only when a query actually runs), so this module can be imported safely
// even when no real database is connected (e.g. at Next.js build time, as
// long as pages that query the DB are marked `dynamic = "force-dynamic"`).

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// AGENTS.md scalability pass, section 12: explicit, bounded pooling instead
// of node-postgres's un-tuned defaults. The load test (see
// scripts/load-test.ts / SCALABILITY_AUDIT.md) surfaced real pool
// exhaustion — routes like vehicles/:id/insights fire several aggregate
// queries per request via Promise.all, so even modest request concurrency
// (15 concurrent HTTP requests) could need well over `pg`'s default pool
// max of 10 simultaneous connections, and requests queuing for a pool slot
// were hanging past client timeouts instead of failing fast.
// `connectionTimeoutMillis` turns "hangs indefinitely" into a clear,
// prompt error (mapped to 500 by handleApiError, distinguishable in logs)
// once the pool is genuinely saturated, per section 22's "fail safely, no
// corrupted state" requirement.
//
// `max` is intentionally kept moderate (not "as high as possible"): in a
// horizontally-scaled deployment (Stage 2) every Next.js instance opens its
// own pool, and Neon's pooled ("-pooler") endpoint this app already uses is
// what absorbs many small per-instance pools — a single instance holding a
// huge pool doesn't scale down when a second instance starts sharing the
// same upstream connection budget. Tune this per-instance number down —
// intentionally, not up — once running as more than one instance.
const POOL_MAX = Number(process.env.DATABASE_POOL_MAX ?? 15);
const CONNECTION_TIMEOUT_MS = 10_000;
const IDLE_TIMEOUT_MS = 30_000;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
    max: POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
