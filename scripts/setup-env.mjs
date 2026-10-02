#!/usr/bin/env node
/**
 * Brings your local env files up to date with the .env.example files.
 *
 *   node scripts/setup-env.mjs          # from the repo root; safe to run any time
 *
 * - admin/.env and mobile/.env.local are created if missing.
 * - Every setting in the example that you don't have yet (in that file or in
 *   its .env/.env.local sibling) is appended with the example's value.
 * - Secrets (AUTH_JWT_SECRET, SESSION_SECRET) are generated when missing or
 *   still the example placeholder; a real secret is never replaced.
 * - Example placeholders ("replace-with-…") are emptied, so the server treats
 *   that setting as not set up instead of trying a fake key.
 * - Values you already set are never changed. A copy of each file is saved
 *   as <file>.bak before it is modified.
 * - Settings still holding a placeholder are listed at the end.
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  { dir: "admin", file: ".env", siblings: [".env", ".env.local", ".env.development.local"] },
  { dir: "mobile", file: ".env.local", siblings: [".env", ".env.local"] },
];

const SECRETS = { AUTH_JWT_SECRET: 48, SESSION_SECRET: 32 };
const isPlaceholder = (v) => /replace-with|change-me|^\s*$/.test(v);

/** Parses KEY=value lines (quoted or not), ignoring comments. */
function parse(text) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out.set(m[1], v);
  }
  return out;
}

const quote = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

let anyChange = false;
const todo = [];

for (const t of TARGETS) {
  const examplePath = join(root, t.dir, ".env.example");
  const targetPath = join(root, t.dir, t.file);
  if (!existsSync(examplePath)) continue;

  const example = parse(readFileSync(examplePath, "utf8"));
  const existingText = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
  const target = parse(existingText);

  // What is already set anywhere (a value in .env.local counts for admin/.env too).
  const known = new Map();
  for (const s of t.siblings) {
    const p = join(root, t.dir, s);
    if (existsSync(p)) for (const [k, v] of parse(readFileSync(p, "utf8"))) if (!known.has(k) || s.includes("local")) known.set(k, v);
  }

  const additions = [];
  let text = existingText;

  // Example placeholders ("replace-with-…") are never real values, but any
  // non-empty value counts as configured, so they would make the server try
  // fake keys. Empty them; the setting then reads as "not set up".
  for (const [key, value] of target) {
    if (key in SECRETS || !/replace-with/.test(value)) continue;
    text = text.replace(new RegExp(`^(\\s*${key}\\s*=).*$`, "m"), `$1""`);
    known.set(key, "");
    additions.push(`${key} (cleared the example placeholder)`);
  }

  for (const [key, exampleValue] of example) {
    if (key in SECRETS) {
      const current = known.get(key);
      if (current !== undefined && !isPlaceholder(current)) continue; // a real secret is never changed
      const secret = randomBytes(SECRETS[key]).toString("base64");
      if (target.has(key)) {
        // Replace the placeholder / too-short secret in place.
        text = text.replace(new RegExp(`^(\\s*${key}\\s*=).*$`, "m"), `$1${quote(secret)}`);
        additions.push(`${key} (generated, replaced the placeholder)`);
      } else if (!known.has(key) || isPlaceholder(known.get(key))) {
        text += `${text && !text.endsWith("\n") ? "\n" : ""}${key}=${quote(secret)}\n`;
        additions.push(`${key} (generated)`);
      }
      continue;
    }
    if (known.has(key)) continue;
    if (!additions.some((a) => a.startsWith("—"))) {
      text += `${text && !text.endsWith("\n") ? "\n" : ""}\n# Added by scripts/setup-env.mjs on ${new Date().toISOString().slice(0, 10)} (see .env.example for what each does)\n`;
      additions.push("— header");
    }
    text += `${key}=${quote(exampleValue)}\n`;
    additions.push(key);
  }

  const rel = relative(root, targetPath);
  const added = additions.filter((a) => !a.startsWith("—"));
  if (added.length > 0) {
    if (existsSync(targetPath)) copyFileSync(targetPath, `${targetPath}.bak`);
    writeFileSync(targetPath, text);
    anyChange = true;
    console.log(`${rel}: updated ${added.length} setting(s): ${added.join(", ")}`);
  } else {
    console.log(`${rel}: already up to date`);
  }

  // Report what still needs a real value.
  const final = new Map(known);
  for (const [k, v] of parse(text)) if (!final.has(k)) final.set(k, v);
  if (t.dir === "admin" && /user:password@/.test(final.get("DATABASE_URL") ?? "")) {
    todo.push(`${rel}: DATABASE_URL still has the example login (user:password). Put your Postgres username and password in it.`);
  }
}

if (todo.length) {
  console.log("\nStill to do:");
  for (const line of todo) console.log(`  - ${line}`);
}
console.log(anyChange ? "\nDone. Copies of the old files were saved with a .bak ending." : "\nNothing to change.");
