import { createApp } from "./app";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { startJobs } from "./jobs";
import { ensureDefaultCategories } from "./modules/categories/categories.routes";
import { ensureDefaultPlans } from "./modules/subscriptions/plans";

async function main() {
  await connectDatabase();
  await ensureDefaultPlans();
  await ensureDefaultCategories();
  const stopJobs = env.JOBS_ENABLED ? startJobs() : () => undefined;
  const server = createApp().listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}/api/v1 (docs: /api/docs)`);
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    stopJobs();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start API");
  process.exit(1);
});
