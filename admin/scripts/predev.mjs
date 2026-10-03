#!/usr/bin/env node
/**
 * Runs before `npm run dev`: regenerates the Prisma client, and when the
 * database schema changed since the last start, clears Next.js's dev build
 * cache. Otherwise Turbopack can keep serving the old generated client
 * ("Export Transmission doesn't exist in target module").
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const admin = join(dirname(fileURLToPath(import.meta.url)), "..");
const generate = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "generate"], {
  cwd: admin,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (generate.status !== 0) process.exit(generate.status ?? 1);

const hash = createHash("sha256").update(readFileSync(join(admin, "prisma", "schema.prisma"))).digest("hex");
const marker = join(admin, ".next", "schema-hash");
const previous = existsSync(marker) ? readFileSync(marker, "utf8") : null;
if (previous !== hash) {
  if (previous !== null) console.log("Database schema changed: clearing the Next.js dev cache.");
  for (const dir of ["dev", "cache"]) rmSync(join(admin, ".next", dir), { recursive: true, force: true });
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, hash);
}
