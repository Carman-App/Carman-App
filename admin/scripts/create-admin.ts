/**
 * Creates an admin console login, or updates one: new password, name, and
 * optionally a two-factor reset for someone who lost their authenticator.
 *
 * Usage (from admin/):
 *   npm run create-admin
 *
 * Asks for the email, name and password (typed hidden, twice). Changing an
 * existing admin's password signs them out everywhere.
 *
 * Unattended (Docker, CI): set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally
 * ADMIN_NAME, ADMIN_ROLE) in the environment and pass --from-env.
 */
import "../load-env";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withLibpqSsl } from "../src/lib/db-url";
import { hashPassword } from "../src/lib/auth/password";
import { AdminRole } from "../src/generated/prisma/enums";
import { ask, rl } from "./lib/ask.mjs";

type Ask = (question: string, opts?: { hidden?: boolean; fallback?: string }) => Promise<string>;
const question = ask as Ask;

const EXAMPLE_PASSWORDS = new Set(["change-me-now", "password", "admin"]);
const MIN_LENGTH = 12;

function passwordProblem(password: string, email: string): string | null {
  if (password.length < MIN_LENGTH) return `The password must be at least ${MIN_LENGTH} characters.`;
  if (EXAMPLE_PASSWORDS.has(password.toLowerCase())) return "That is the example password; choose your own.";
  if (password.toLowerCase().includes(email.split("@")[0])) return "The password must not contain the email name.";
  return null;
}

async function fromPrompts(prisma: PrismaClient) {
  console.log("Carma admin console login.\n");
  const email = (await question("Admin email: ")).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That is not an email address.");

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  console.log(existing ? `Updating ${existing.name} (${existing.role}).` : "No admin with that email yet: creating one.");

  const name = await question(`Name${existing ? ` [${existing.name}]` : " [Admin]"}: `, { fallback: existing?.name ?? "Admin" });

  let password = "";
  for (;;) {
    password = await question(
      existing ? `New password (at least ${MIN_LENGTH} characters; Enter to keep the current one): ` : `Password (at least ${MIN_LENGTH} characters): `,
      { hidden: true },
    );
    if (!password && existing) break;
    const problem = passwordProblem(password, email);
    if (problem) {
      console.log(problem);
      continue;
    }
    if ((await question("Type it again: ", { hidden: true })) !== password) {
      console.log("The two passwords did not match.");
      continue;
    }
    break;
  }

  let resetTwoFactor = false;
  if (existing?.twoFactorEnabled) {
    resetTwoFactor = /^y/i.test(await question("Reset two-factor (lost authenticator app)? [y/N]: "));
  }
  rl.close();
  return { email, name, password, resetTwoFactor, role: existing?.role ?? AdminRole.OWNER };
}

function fromEnv() {
  rl.close();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) throw new Error("--from-env needs ADMIN_EMAIL and ADMIN_PASSWORD.");
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(`ADMIN_PASSWORD: ${problem}`);
  const roleInput = process.env.ADMIN_ROLE?.trim().toUpperCase();
  const validRoles = Object.values(AdminRole) as string[];
  if (roleInput && !validRoles.includes(roleInput)) throw new Error(`ADMIN_ROLE must be one of: ${validRoles.join(", ")}`);
  // Default OWNER: this is how the very first admin is created, and there is
  // nobody else yet to grant a narrower role. Create narrower-role admins
  // from Admins & roles (AUD-04) once signed in.
  return {
    email,
    name: process.env.ADMIN_NAME?.trim() || "Admin",
    password,
    resetTwoFactor: false,
    role: (roleInput as AdminRole | undefined) ?? AdminRole.OWNER,
  };
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: withLibpqSsl(process.env.DATABASE_URL ?? "") }) });
  try {
    const input = process.argv.includes("--from-env") ? fromEnv() : await fromPrompts(prisma);
    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    const existing = await prisma.adminUser.findUnique({ where: { email: input.email } });

    if (!existing) {
      if (!passwordHash) throw new Error("A new admin needs a password.");
      const admin = await prisma.adminUser.create({ data: { email: input.email, name: input.name, passwordHash, role: input.role } });
      console.log(`\nCreated ${admin.email} (${admin.role}).`);
      console.log("Sign in at /login; you'll set up two-factor (an authenticator app) the first time.");
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          disabledAt: null,
          ...(passwordHash ? { passwordHash } : {}),
          ...(input.resetTwoFactor ? { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] } : {}),
        },
      });
      // A new password or a two-factor reset ends every existing session.
      if (passwordHash || input.resetTwoFactor) await tx.adminSession.deleteMany({ where: { adminUserId: existing.id } });
    });
    console.log(`\nUpdated ${existing.email}${passwordHash ? ": new password" : ""}${input.resetTwoFactor ? ", two-factor reset" : ""}.`);
    if (passwordHash || input.resetTwoFactor) console.log("Signed out everywhere; sign in again at /login.");
    if (existing.disabledAt) console.log("The account had been deactivated; it is active again.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
