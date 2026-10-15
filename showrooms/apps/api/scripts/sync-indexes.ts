/**
 * Builds/updates MongoDB indexes declared on the models. Run once per release
 * in production, where autoIndex is disabled so app start-up never blocks on
 * index builds:  pnpm --filter @showrooms/api sync-indexes
 */
import mongoose from "mongoose";
import "../src/app";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { logger } from "../src/config/logger";

await connectDatabase();
for (const name of mongoose.modelNames()) {
  const dropped = await mongoose.model(name).syncIndexes();
  logger.info({ model: name, dropped }, "Indexes in sync");
}
await disconnectDatabase();
