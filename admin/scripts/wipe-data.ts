/**
 * Deletes every account and everything people recorded (users, garages,
 * vehicles, records, documents, workshops, jobs, notifications, support
 * tickets, subscriptions…) from the database in DATABASE_URL.
 *
 * Kept: admin console logins and their history, the audit log, plans and
 * prices, document types, countries, config lists, feature flags, message
 * templates, campaigns, banners and other console settings, so the server
 * and console keep working. Uploaded files in the storage bucket are not
 * touched.
 *
 * Usage (from admin/):  npm run db:wipe
 * Asks you to type the database name before doing anything. Cannot be undone.
 */
import "../load-env";
import { Client } from "pg";
import { withLibpqSsl } from "../src/lib/db-url";
import { ask, rl } from "./lib/ask.mjs";

type Ask = (question: string, opts?: { hidden?: boolean; fallback?: string }) => Promise<string>;
const question = ask as Ask;

/** Console and server settings: never wiped. */
const KEEP = new Set([
  "_prisma_migrations",
  "admin_users",
  "admin_sessions",
  "admin_pulse_preferences",
  "audit_logs",
  "retention_purge_logs",
  "retention_rules",
  "plans",
  "plan_prices",
  "subscription_rules",
  "document_types",
  "countries",
  "fx_rates",
  "config_lists",
  "config_list_items",
  "config_versions",
  "feature_flags",
  "notification_templates",
  "campaigns",
  "segments",
  "banners",
  "whats_new_notes",
]);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set in admin/.env.");
  const target = new URL(url);
  const dbName = target.pathname.replace(/^\//, "") || "postgres";

  const db = new Client({ connectionString: withLibpqSsl(url) });
  await db.connect();
  try {
    const { rows } = await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    const wipe = rows.map((r) => r.tablename).filter((t) => !KEEP.has(t));
    const { rows: counts } = await db.query<{ n: string }>(`SELECT count(*) AS n FROM accounts`);

    console.log(`Database: ${dbName} on ${target.hostname}`);
    console.log(`This deletes ${counts[0].n} account(s) and everything recorded in ${wipe.length} tables.`);
    console.log("Admin logins, plans and console settings are kept. This cannot be undone.\n");
    const answer = await question(`To delete everything, type the word ${dbName} exactly: `);
    rl.close();
    if (answer !== dbName) {
      console.log(`Nothing deleted: you typed "${answer}", not "${dbName}".`);
      return;
    }

    // One statement: tables that reference each other are emptied together.
    // No CASCADE, so a kept table can never be emptied by accident.
    await db.query(`TRUNCATE TABLE ${wipe.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY`);
    console.log(`\nDeleted. ${wipe.length} tables are empty; settings and admin logins are unchanged.`);
    console.log("Sign in to the app again to start fresh.");
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  rl.close();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
