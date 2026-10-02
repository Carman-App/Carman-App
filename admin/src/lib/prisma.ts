import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter for SQL datasources — see
// prisma/schema.prisma and prisma.config.ts. DATABASE_URL is read lazily
// (only when a query actually runs), so this module can be imported safely
// even when no real database is connected (e.g. at Next.js build time, as
// long as pages that query the DB are marked `dynamic = "force-dynamic"`).
//
// Scaling (see DEPLOY.md):
// - DATABASE_URL should point at a connection pooler (PgBouncer in
//   transaction mode, or the provider's pooled URL). DATABASE_POOL_MAX caps
//   the connections each server instance holds open to it (default 10).
// - DATABASE_READ_URL, when set, points at a read replica. `prismaRead` is
//   used by reporting screens that only read (Pulse, Growth, data quality,
//   revenue, work overview), so heavy counting never competes with app
//   writes. Unset, it is the same client as `prisma`.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaRead: PrismaClient | undefined;
};

function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient(process.env.DATABASE_URL ?? "");

/** Read-only client for reporting queries; a replica when DATABASE_READ_URL is set. */
export const prismaRead =
  globalForPrisma.prismaRead ?? (process.env.DATABASE_READ_URL ? createPrismaClient(process.env.DATABASE_READ_URL) : prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRead = prismaRead;
}
