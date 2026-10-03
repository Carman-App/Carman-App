#!/usr/bin/env node
/**
 * Connects Carma to a Supabase project's Postgres.
 *
 *   node scripts/setup-supabase.mjs        # from the repo root
 *
 * Asks for the project (URL or ref) and the database password (not saved
 * anywhere but admin/.env), then:
 *   1. finds the project's region by trying Supabase's poolers,
 *   2. writes DATABASE_URL (transaction pooler, port 6543) and
 *      DIRECT_DATABASE_URL (session pooler, port 5432) into admin/.env,
 *      keeping a .bak copy,
 *   3. runs the migrations and loads the plans and demo data,
 *   4. optionally sets up file storage on Supabase Storage (S3 keys from
 *      Storage → S3 Connection) and creates the private bucket.
 * Safe to run again.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ask, rl } from "./lib/ask.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const admin = join(root, "admin");
const envFile = join(admin, ".env");
const require = createRequire(join(admin, "package.json"));

let pg;
try {
  pg = require("pg");
} catch {
  console.error("Run `npm install` in admin/ first, then run this again.");
  process.exit(1);
}

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "sa-east-1",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2", "eu-north-1",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
];
const HOSTS = REGIONS.flatMap((r) => [`aws-0-${r}`, `aws-1-${r}`]).map((h) => `${h}.pooler.supabase.com`);

function readEnv() {
  return existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
}

function envValue(text, key) {
  const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\n]*)"?\\s*$`, "m"));
  return m ? m[1].trim() : "";
}

function writeEnv(values) {
  let text = readEnv();
  if (text) copyFileSync(envFile, `${envFile}.bak`);
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}="${value}"`;
    const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`;
  }
  writeFileSync(envFile, text);
}

/** Tries one pooler: "ok", "password" (right region, wrong password) or "no". */
async function probe(host, user, password) {
  const client = new pg.Client({
    host, port: 5432, user, password, database: "postgres",
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    await client.end();
    return "ok";
  } catch (e) {
    return /password authentication failed/i.test(e.message) ? "password" : "no";
  }
}

async function main() {
  console.log("Connect Carma to Supabase.\n");
  const existing = readEnv();
  const known = envValue(existing, "SUPABASE_URL");
  const project = await ask(`Supabase project URL or ref${known ? ` [${known}]` : ""}: `, { fallback: known });
  const ref = (project.match(/^(?:https?:\/\/)?([a-z0-9]{20})(?:\.supabase\.co)?\/?$/) ?? [])[1];
  if (!ref) {
    console.error("That isn't a Supabase project URL (https://<ref>.supabase.co) or a 20-letter project ref.");
    process.exit(1);
  }
  console.log("The database password is the one set for the project's Postgres (Project Settings → Database),");
  console.log("not your Supabase login and not an API key.");
  const password = await ask("Database password: ", { hidden: true });
  if (!password) {
    console.error("No password given.");
    process.exit(1);
  }

  const user = `postgres.${ref}`;
  console.log("\nFinding your project's region…");
  const results = await Promise.all(HOSTS.map(async (h) => [h, await probe(h, user, password)]));
  const found = results.find(([, r]) => r === "ok");
  if (!found) {
    rl.close();
    if (results.some(([, r]) => r === "password")) {
      console.error("Found the project, but Supabase rejected the password. Reset it under Project Settings → Database and run this again.");
    } else {
      console.error("Could not reach the project on any Supabase pooler. Check the project ref, that the project isn't paused, and your internet connection.");
    }
    process.exit(1);
  }
  const host = found[0];
  const region = host.replace(/^aws-\d-/, "").replace(".pooler.supabase.com", "");
  console.log(`Connected (${region}).`);

  const pw = encodeURIComponent(password);
  writeEnv({
    SUPABASE_URL: `https://${ref}.supabase.co`,
    DATABASE_URL: `postgresql://${user}:${pw}@${host}:6543/postgres?sslmode=require`,
    DIRECT_DATABASE_URL: `postgresql://${user}:${pw}@${host}:5432/postgres?sslmode=require`,
  });
  console.log("Wrote DATABASE_URL and DIRECT_DATABASE_URL to admin/.env (old file saved as .env.bak).\n");

  console.log("Document storage on Supabase (optional): create keys under Storage → S3 Connection → New access key.");
  const keyId = await ask("S3 access key ID (Enter to skip): ");
  const keySecret = keyId ? await ask("S3 secret access key: ", { hidden: true }) : "";
  rl.close();

  const run = (args) => spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { cwd: admin, stdio: "inherit", shell: process.platform === "win32" });
  console.log("\nRunning migrations…");
  if (run(["prisma", "migrate", "deploy"]).status !== 0) process.exit(1);
  console.log("Loading the plans and demo account…");
  if (run(["tsx", "prisma/seed.ts"]).status !== 0) process.exit(1);

  if (keyId && keySecret) {
    const bucket = envValue(readEnv(), "S3_BUCKET") || "documents";
    const endpoint = `https://${ref}.storage.supabase.co/storage/v1/s3`;
    const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");
    const s3 = new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId: keyId, secretAccessKey: keySecret } });
    try {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`Created the private bucket "${bucket}".`);
    } catch (e) {
      if (!/BucketAlreadyExists|BucketAlreadyOwnedByYou|already exists/i.test(`${e.name} ${e.message}`)) {
        console.error(`Could not create the bucket: ${e.message}. Check the S3 keys; the database is set up.`);
        process.exit(1);
      }
      console.log(`Using the existing bucket "${bucket}".`);
    }
    writeEnv({ S3_BUCKET: bucket, S3_REGION: region, S3_ENDPOINT: endpoint, S3_ACCESS_KEY_ID: keyId, S3_SECRET_ACCESS_KEY: keySecret });
    console.log("Wrote the S3_* settings to admin/.env.");
  }

  console.log("\nDone. Start the server with: cd admin && npm run dev");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
