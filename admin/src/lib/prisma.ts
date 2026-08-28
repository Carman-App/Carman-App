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

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
