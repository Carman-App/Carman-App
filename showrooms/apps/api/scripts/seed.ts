/**
 * Demo data for local development. Refuses to run against production.
 * Phase 1 seeds accounts only; vehicles are added with the listings module.
 */
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { env } from "../src/config/env";
import { logger } from "../src/config/logger";
import { hashPassword } from "../src/modules/auth/password";
import { User } from "../src/modules/users/user.model";

if (env.APP_ENV === "production") {
  throw new Error("Refusing to seed a production database");
}

const DEMO_PASSWORD = "Showroom2026";

const users = [
  { name: "Showrooms Admin", email: "admin@showrooms.test", role: "ADMIN", phone: "+254700000001" },
  { name: "Wanjiku Kamau", email: "buyer@showrooms.test", role: "BUYER", phone: "+254711000002" },
  { name: "Otieno Motors", email: "broker@showrooms.test", role: "BROKER", phone: "+254722000003" },
  { name: "Coast Auto Dealers", email: "dealer@showrooms.test", role: "DEALER", phone: "+254733000004" },
] as const;

await connectDatabase();
const passwordHash = await hashPassword(DEMO_PASSWORD);
for (const u of users) {
  await User.updateOne(
    { email: u.email },
    { $setOnInsert: { ...u, passwordHash, status: "ACTIVE", emailVerifiedAt: new Date() } },
    { upsert: true },
  );
}
logger.info(`Seeded ${users.length} demo accounts (password: ${DEMO_PASSWORD})`);
await disconnectDatabase();
