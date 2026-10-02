/**
 * IDOR (Insecure Direct Object Reference) test pass — AGENTS.md scalability
 * pass, section 3: "every protected query must chain authenticated user ->
 * account -> membership -> role -> resource -> permission... test for
 * IDOR." This is a real, executable test against the ACTUAL running dev
 * server (not a unit test with mocked auth) — it builds two fully separate
 * tenants directly in the database (an "attacker" and a "victim", each with
 * their own garage/vehicle/workshop/job/estimate/invoice/document/access
 * grant), then sends real HTTP requests carrying the ATTACKER's
 * `x-carma-account-id` header at the VICTIM's resource ids and asserts the
 * API rejects every one of them — plus a positive control per resource
 * (the victim's own header against their own resource) so a false pass
 * from a broken/misrouted endpoint can't hide as "everything 403s".
 *
 * Usage:
 *   npm run dev                    # in one terminal
 *   npx tsx scripts/idor-check.ts  # in another (BASE_URL env var to override)
 *
 * This is a standalone script (same pattern as scripts/create-admin.ts and
 * prisma/seed.ts) rather than a test-framework suite — this repo has no
 * test runner installed (no vitest/jest in package.json), and adding one
 * is a bigger call than this hardening pass should make unilaterally; a
 * plain script that makes real HTTP requests and asserts real responses is
 * still a genuine, repeatable test, just run via `npx tsx` instead of
 * `npm test`. Exits non-zero if any case fails, so it's CI-usable as-is.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE_URL = process.env.IDOR_BASE_URL ?? "http://localhost:3000/api/v1";

type Case = {
  name: string;
  method: "GET" | "POST";
  path: string;
  accountId: string;
  body?: unknown;
  expect: number[]; // acceptable status codes for this call
};

const results: { name: string; ok: boolean; status: number; expected: number[] }[] = [];

async function call(c: Case): Promise<number> {
  const res = await fetch(`${BASE_URL}/${c.path.replace(/^\//, "")}`, {
    method: c.method,
    headers: { "Content-Type": "application/json", "x-carma-account-id": c.accountId },
    body: c.body !== undefined ? JSON.stringify(c.body) : undefined,
  });
  return res.status;
}

async function run(c: Case) {
  let status: number;
  try {
    status = await call(c);
  } catch (error) {
    console.error(`  [ERROR] ${c.name}: could not reach dev server — is \`npm run dev\` running? (${error})`);
    results.push({ name: c.name, ok: false, status: -1, expected: c.expect });
    return;
  }
  const ok = c.expect.includes(status);
  results.push({ name: c.name, ok, status, expected: c.expect });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${c.name} — got ${status}, expected one of [${c.expect.join(", ")}]`);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  const suffix = Date.now().toString(36);
  const victimUserId = `idor-victim-user-${suffix}`;
  const attackerUserId = `idor-attacker-user-${suffix}`;

  console.log("Setting up isolated victim/attacker fixtures...");

  // --- Victim: full fixture with a garage/vehicle/workshop/job/estimate/invoice/document/access-grant ---
  const victimUser = await prisma.user.create({
    data: { id: victimUserId, email: `idor-victim-${suffix}@example.invalid`, name: "IDOR Victim" },
  });
  const victim = await prisma.account.create({ data: { userId: victimUser.id, region: "KE" } });
  const victimGarage = await prisma.garage.create({
    data: {
      ownerId: victim.id,
      name: "Victim Garage",
      location: "Nowhere",
      members: { create: { accountId: victim.id, role: "OWNER", displayName: "Victim" } },
    },
  });
  const victimVehicle = await prisma.vehicle.create({
    data: { garageId: victimGarage.id, make: "Test", model: "Victim Car", year: 2020, plate: `IDOR-${suffix}` },
  });
  await prisma.fuelRecord.create({
    data: { vehicleId: victimVehicle.id, date: new Date(), amount: 100, odometerAtEntry: 100, enteredByName: "Victim" },
  });
  const docType = await prisma.documentType.upsert({
    where: { code: "idor_test_doc" },
    update: {},
    create: { code: "idor_test_doc", label: "IDOR Test Document" },
  });
  await prisma.document.create({
    data: { vehicleId: victimVehicle.id, documentTypeId: docType.id, title: "Victim doc" },
  });
  const victimWorkshop = await prisma.workshop.create({
    data: {
      ownerId: victim.id,
      name: "Victim Workshop",
      members: { create: { accountId: victim.id, role: "OWNER", displayName: "Victim" } },
    },
  });
  const victimCustomer = await prisma.workshopCustomer.create({
    data: { workshopId: victimWorkshop.id, name: "Victim Customer" },
  });
  const victimJob = await prisma.job.create({
    data: {
      workshopId: victimWorkshop.id,
      customerId: victimCustomer.id,
      vehicleId: victimVehicle.id,
      faultDescription: "IDOR test job",
    },
  });
  const victimEstimate = await prisma.estimate.create({
    data: { jobId: victimJob.id, vehicleId: victimVehicle.id, workshopId: victimWorkshop.id, total: 1000 },
  });
  const victimInvoice = await prisma.invoice.create({
    data: { jobId: victimJob.id, vehicleId: victimVehicle.id, workshopId: victimWorkshop.id, total: 1000 },
  });
  const victimAccessRequest = await prisma.accessRequest.create({
    data: { vehicleId: victimVehicle.id, workshopId: victimWorkshop.id, scope: "full" },
  });
  const victimAccessGrant = await prisma.accessGrant.create({
    data: {
      vehicleId: victimVehicle.id,
      workshopId: victimWorkshop.id,
      scope: "full",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // --- Attacker: an unrelated tenant with their own garage/vehicle/workshop (sanity/positive controls) ---
  const attackerUser = await prisma.user.create({
    data: { id: attackerUserId, email: `idor-attacker-${suffix}@example.invalid`, name: "IDOR Attacker" },
  });
  const attacker = await prisma.account.create({ data: { userId: attackerUser.id, region: "KE" } });
  const attackerGarage = await prisma.garage.create({
    data: {
      ownerId: attacker.id,
      name: "Attacker Garage",
      location: "Nowhere",
      members: { create: { accountId: attacker.id, role: "OWNER", displayName: "Attacker" } },
    },
  });
  const attackerVehicle = await prisma.vehicle.create({
    data: { garageId: attackerGarage.id, make: "Test", model: "Attacker Car", year: 2020, plate: `IDOR-ATK-${suffix}` },
  });

  console.log(`Fixtures ready. victimAccount=${victim.id} attackerAccount=${attacker.id}`);
  console.log(`Testing against ${BASE_URL} — make sure \`npm run dev\` is running.\n`);

  const cases: Case[] = [
    // --- Cross-account reads: attacker's header against victim's resources ---
    { name: "GET garage (cross-account)", method: "GET", path: `garages/${victimGarage.id}`, accountId: attacker.id, expect: [403] },
    { name: "GET garage members (cross-account)", method: "GET", path: `garages/${victimGarage.id}/members`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle records (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}/records`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle timeline (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}/timeline`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle insights (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}/insights`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle documents (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}/documents`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle estimates (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}/estimates`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle invoices (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}/invoices`, accountId: attacker.id, expect: [403] },
    { name: "GET vehicle access-requests (cross-account)", method: "GET", path: `vehicles/${victimVehicle.id}/access-requests`, accountId: attacker.id, expect: [403] },
    { name: "GET workshop (cross-account)", method: "GET", path: `workshops/${victimWorkshop.id}`, accountId: attacker.id, expect: [403] },
    { name: "GET workshop customers (cross-account)", method: "GET", path: `workshops/${victimWorkshop.id}/customers`, accountId: attacker.id, expect: [403] },
    { name: "GET workshop jobs (cross-account)", method: "GET", path: `workshops/${victimWorkshop.id}/jobs`, accountId: attacker.id, expect: [403] },
    { name: "GET estimate by id (cross-account)", method: "GET", path: `estimates/${victimEstimate.id}`, accountId: attacker.id, expect: [403] },
    { name: "GET invoice by id (cross-account)", method: "GET", path: `invoices/${victimInvoice.id}`, accountId: attacker.id, expect: [403] },

    // --- Cross-account writes: attacker attempts to mutate victim's data ---
    {
      name: "POST vehicle record (cross-account write)",
      method: "POST",
      path: `vehicles/${victimVehicle.id}/records`,
      accountId: attacker.id,
      body: { type: "fuel", date: new Date().toISOString(), amount: 1, odometerAtEntry: 1, enteredByName: "Attacker" },
      expect: [403],
    },
    {
      name: "POST estimate decision (cross-account write)",
      method: "POST",
      path: `estimates/${victimEstimate.id}/decision`,
      accountId: attacker.id,
      body: { decision: "APPROVED" },
      expect: [403],
    },
    {
      name: "POST access-request approve (cross-account write)",
      method: "POST",
      path: `access-requests/${victimAccessRequest.id}/approve`,
      accountId: attacker.id,
      body: {},
      expect: [403],
    },
    {
      name: "POST access-grant revoke (cross-account write)",
      method: "POST",
      path: `access-grants/${victimAccessGrant.id}/revoke`,
      accountId: attacker.id,
      expect: [403],
    },
    {
      name: "POST job status change (cross-account write)",
      method: "POST",
      path: `jobs/${victimJob.id}/status`,
      accountId: attacker.id,
      body: { status: "AWAITING_APPROVAL" },
      expect: [403],
    },

    // --- Unauthenticated (no header at all) ---
    { name: "GET vehicle (no auth header)", method: "GET", path: `vehicles/${victimVehicle.id}`, accountId: "", expect: [401] },

    // --- Positive controls: victim's own header against their own resources must actually work ---
    { name: "GET garage (owner, control)", method: "GET", path: `garages/${victimGarage.id}`, accountId: victim.id, expect: [200] },
    { name: "GET vehicle (owner, control)", method: "GET", path: `vehicles/${victimVehicle.id}`, accountId: victim.id, expect: [200] },
    { name: "GET vehicle records (owner, control)", method: "GET", path: `vehicles/${victimVehicle.id}/records`, accountId: victim.id, expect: [200] },
    { name: "GET vehicle insights (owner, control)", method: "GET", path: `vehicles/${victimVehicle.id}/insights`, accountId: victim.id, expect: [200] },
    { name: "GET workshop jobs (owner, control)", method: "GET", path: `workshops/${victimWorkshop.id}/jobs`, accountId: victim.id, expect: [200] },
    { name: "GET estimate by id (owner, control)", method: "GET", path: `estimates/${victimEstimate.id}`, accountId: victim.id, expect: [200] },
    { name: "GET invoice by id (owner, control)", method: "GET", path: `invoices/${victimInvoice.id}`, accountId: victim.id, expect: [200] },

    // --- Attacker acting on their OWN resources must also work (proves the account isn't just globally broken) ---
    { name: "GET garage (attacker's own, control)", method: "GET", path: `garages/${attackerGarage.id}`, accountId: attacker.id, expect: [200] },
    { name: "GET vehicle (attacker's own, control)", method: "GET", path: `vehicles/${attackerVehicle.id}`, accountId: attacker.id, expect: [200] },
  ];

  for (const c of cases) {
    await run(c);
  }

  console.log("\nCleaning up fixtures...");
  await prisma.user.delete({ where: { id: victimUser.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: attackerUser.id } }).catch(() => {});
  await prisma.$disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log("FAILED CASES:");
    for (const f of failed) console.log(`  - ${f.name} (got ${f.status}, expected [${f.expected.join(", ")}])`);
    process.exit(1);
  }
  console.log("All IDOR checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
