#!/usr/bin/env node
/**
 * Sets up the local Postgres database for Carma and fills in DATABASE_URL.
 *
 *   npm run setup:db        # from admin/, with Postgres running
 *
 * Asks for your Postgres admin login once (the "postgres" user and the
 * password you chose when installing PostgreSQL; it is not saved), then:
 *   1. creates (or updates) a database user "carma" with a new random password,
 *   2. creates the "carma" database owned by it (or takes over an existing one),
 *   3. writes DATABASE_URL into admin/.env (or admin/.env.local if that is
 *      where you keep it), keeping a .bak copy,
 *   4. runs the migrations and loads the plans and settings.
 * Safe to run again: it only resets the carma user's password.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ask, rl } from "./lib/ask.mjs";

const admin = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(admin, "package.json"));

let pg;
try {
  pg = require("pg");
} catch {
  console.error("Run `npm install` in admin/ first, then run this again.");
  process.exit(1);
}

const ident = (s) => `"${s.replace(/"/g, '""')}"`;
const literal = (s) => `'${s.replace(/'/g, "''")}'`;

async function main() {
  console.log("Carma database setup. Postgres must be running.\n");
  const host = await ask("Postgres host [localhost]: ", { fallback: "localhost" });
  const port = Number(await ask("Port [5432]: ", { fallback: "5432" }));
  const adminUser = await ask("Postgres admin user [postgres]: ", { fallback: "postgres" });
  const adminPassword = await ask(`Password for ${adminUser} (the one you set when installing PostgreSQL): `, { hidden: true });
  rl.close();

  const db = new pg.Client({ host, port, user: adminUser, password: adminPassword, database: "postgres" });
  try {
    await db.connect();
  } catch (e) {
    console.error(`\nCould not sign in to Postgres as ${adminUser}: ${e.message}`);
    console.error("Check the password (it is the one chosen when PostgreSQL was installed) and that Postgres is running.");
    process.exit(1);
  }

  const appUser = "carma";
  const dbName = "carma";
  const password = randomBytes(18).toString("base64url");

  const role = await db.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [appUser]);
  if (role.rowCount) await db.query(`ALTER ROLE ${ident(appUser)} WITH LOGIN PASSWORD ${literal(password)}`);
  else await db.query(`CREATE ROLE ${ident(appUser)} WITH LOGIN PASSWORD ${literal(password)}`);
  // Migrations create the schema; the user needs to be able to create a database for Prisma's checks too.
  await db.query(`ALTER ROLE ${ident(appUser)} CREATEDB`);

  const exists = await db.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount) {
    await db.query(`ALTER DATABASE ${ident(dbName)} OWNER TO ${ident(appUser)}`);
    console.log(`Database "${dbName}" already existed; it now belongs to "${appUser}".`);
  } else {
    await db.query(`CREATE DATABASE ${ident(dbName)} OWNER ${ident(appUser)}`);
    console.log(`Created database "${dbName}".`);
  }
  await db.end();

  // The public schema of an existing database may belong to another user: hand it over.
  const owner = new pg.Client({ host, port, user: adminUser, password: adminPassword, database: dbName });
  await owner.connect();
  await owner.query(`ALTER SCHEMA public OWNER TO ${ident(appUser)}`);
  await owner.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${ident(appUser)}`);
  await owner.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${ident(appUser)}`);
  const tables = await owner.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  for (const t of tables.rows) await owner.query(`ALTER TABLE public.${ident(t.tablename)} OWNER TO ${ident(appUser)}`);
  const types = await owner.query("SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'");
  for (const t of types.rows) await owner.query(`ALTER TYPE public.${ident(t.typname)} OWNER TO ${ident(appUser)}`);
  await owner.end();

  const url = `postgresql://${appUser}:${password}@${host}:${port}/${dbName}`;
  const local = join(admin, ".env.local");
  const target = existsSync(local) && /^\s*DATABASE_URL\s*=/m.test(readFileSync(local, "utf8")) ? local : join(admin, ".env");
  const before = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (before) copyFileSync(target, `${target}.bak`);
  const line = `DATABASE_URL="${url}"`;
  const after = /^\s*DATABASE_URL\s*=.*$/m.test(before) ? before.replace(/^\s*DATABASE_URL\s*=.*$/m, line) : `${before}${before && !before.endsWith("\n") ? "\n" : ""}${line}\n`;
  writeFileSync(target, after);
  console.log(`Wrote DATABASE_URL to admin/${target.endsWith(".local") ? ".env.local" : ".env"} (old file saved as .bak).\n`);

  const run = (args) => spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { cwd: admin, stdio: "inherit", shell: process.platform === "win32" });
  console.log("Running migrations…");
  if (run(["prisma", "migrate", "deploy"]).status !== 0) process.exit(1);
  console.log("Loading the plans and settings…");
  if (run(["tsx", "prisma/seed.ts"]).status !== 0) process.exit(1);

  console.log("\nDone. Start the server with: npm run dev");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
