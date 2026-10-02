/**
 * Creates (or updates the password for) the first AdminUser, from
 * ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 *
 * Usage:
 *   npm run create-admin
 */
import "../load-env";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/auth/password";
import { AdminRole } from "../src/generated/prisma/enums";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Admin";
  const roleInput = process.env.ADMIN_ROLE?.trim().toUpperCase();

  if (!email || !password) {
    console.error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before running `npm run create-admin`.",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const validRoles = Object.values(AdminRole) as string[];
  if (roleInput && !validRoles.includes(roleInput)) {
    console.error(`ADMIN_ROLE must be one of: ${validRoles.join(", ")}`);
    process.exit(1);
  }
  // Default OWNER: this script is how the very first admin is created, and
  // there is nobody else yet to grant a narrower role — see AGENTS.md
  // section 03. Create additional, narrower-role admins from the
  // Admins & roles screen (AUD-04) once signed in, not this script.
  const role = (roleInput as AdminRole | undefined) ?? AdminRole.OWNER;

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await hashPassword(password);
    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash, name },
      create: { email, passwordHash, name, role },
    });
    console.log(`AdminUser ready: ${admin.email} (id: ${admin.id}, role: ${admin.role})`);
    console.log(
      "Two-factor authentication is required (AUD-05) — you'll be walked through setup on first sign-in.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to create admin user:", error);
  process.exit(1);
});
