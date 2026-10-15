/**
 * The only way to create an administrator. Admin accounts are never created
 * through the public API.
 *
 *   ADMIN_EMAIL=ops@example.com ADMIN_PASSWORD='...' ADMIN_NAME='Ops' pnpm --filter @showrooms/api create-admin
 */
import { z } from "zod";
import { emailSchema, passwordSchema } from "@showrooms/shared";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { logger } from "../src/config/logger";
import { hashPassword } from "../src/modules/auth/password";
import { audit } from "../src/modules/audit/audit.service";
import { User } from "../src/modules/users/user.model";

const input = z
  .object({ ADMIN_EMAIL: emailSchema, ADMIN_PASSWORD: passwordSchema, ADMIN_NAME: z.string().min(2).default("Administrator") })
  .parse(process.env);

await connectDatabase();
const existing = await User.findOne({ email: input.ADMIN_EMAIL });
if (existing) {
  existing.role = "ADMIN";
  existing.status = "ACTIVE";
  await existing.save();
  logger.info({ email: input.ADMIN_EMAIL }, "Existing user promoted to ADMIN");
} else {
  const admin = await User.create({
    name: input.ADMIN_NAME,
    email: input.ADMIN_EMAIL,
    role: "ADMIN",
    passwordHash: await hashPassword(input.ADMIN_PASSWORD),
    emailVerifiedAt: new Date(),
  });
  logger.info({ email: admin.email }, "Admin created");
}
await audit({ action: "admin.created_by_script", metadata: { email: input.ADMIN_EMAIL } });
await disconnectDatabase();
