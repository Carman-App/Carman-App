/**
 * Load test — AGENTS.md scalability pass, section 21. Uses `autocannon` (a
 * plain npm devDependency, no new infrastructure) against the ACTUAL
 * running dev server and the real Neon Postgres database, for the
 * endpoints named in the spec: auth, vehicle listing, vehicle timeline,
 * vehicle record creation, workshop job board, job creation, estimate
 * retrieval, invoice retrieval, dashboard aggregation, notifications,
 * report creation.
 *
 * These are DEV-ENVIRONMENT measurements — a single `next dev` (Turbopack,
 * unoptimized) process on a developer machine against a real but
 * not-dedicated Neon branch, not a production capacity claim. Treat the
 * numbers as relative/diagnostic (which endpoints are slow, whether
 * indexes help, whether error rate stays 0 under load), not as an SLA.
 *
 * Usage:
 *   npm run dev                # in one terminal
 *   npm run load:test          # in another (LOAD_TEST_BASE_URL to override)
 */
import "dotenv/config";
import autocannon from "autocannon";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE_URL = process.env.LOAD_TEST_BASE_URL ?? "http://localhost:3000/api/v1";
const DURATION_SECONDS = Number(process.env.LOAD_TEST_DURATION ?? 10);
const CONNECTIONS = Number(process.env.LOAD_TEST_CONNECTIONS ?? 20);

type Scenario = {
  name: string;
  method: "GET" | "POST";
  path: (ctx: Fixtures) => string;
  body?: (ctx: Fixtures) => Record<string, unknown>;
  accountId: (ctx: Fixtures) => string;
};

type Fixtures = {
  accountId: string;
  garageId: string;
  vehicleId: string;
  workshopId: string;
  customerId: string;
  estimateId: string;
  invoiceId: string;
};

async function setupFixtures(): Promise<{ fixtures: Fixtures; cleanup: () => Promise<void> }> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  const suffix = Date.now().toString(36);
  const userId = `load-test-user-${suffix}`;
  const user = await prisma.user.create({
    data: { id: userId, email: `load-test-${suffix}@example.invalid`, name: "Load Test" },
  });
  const account = await prisma.account.create({ data: { userId: user.id, region: "KE" } });
  const garage = await prisma.garage.create({
    data: {
      ownerId: account.id,
      name: "Load Test Garage",
      location: "Nowhere",
      members: { create: { accountId: account.id, role: "OWNER", displayName: "Load Test" } },
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: { garageId: garage.id, make: "Test", model: "Load Test Car", year: 2020, plate: `LOAD-${suffix}` },
  });
  // A little history so vehicle timeline/insights have real rows to aggregate over.
  await prisma.fuelRecord.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      vehicleId: vehicle.id,
      date: new Date(Date.now() - i * 86400000),
      amount: 1000 + i,
      odometerAtEntry: 1000 + i * 10,
      enteredByName: "Load Test",
    })),
  });
  const workshop = await prisma.workshop.create({
    data: {
      ownerId: account.id,
      name: "Load Test Workshop",
      members: { create: { accountId: account.id, role: "OWNER", displayName: "Load Test" } },
    },
  });
  const customer = await prisma.workshopCustomer.create({
    data: { workshopId: workshop.id, name: "Load Test Customer" },
  });
  const job = await prisma.job.create({
    data: { workshopId: workshop.id, customerId: customer.id, vehicleId: vehicle.id, faultDescription: "Load test" },
  });
  const estimate = await prisma.estimate.create({
    data: { jobId: job.id, vehicleId: vehicle.id, workshopId: workshop.id, total: 1000 },
  });
  const invoice = await prisma.invoice.create({
    data: { jobId: job.id, vehicleId: vehicle.id, workshopId: workshop.id, total: 1000 },
  });

  const fixtures: Fixtures = {
    accountId: account.id,
    garageId: garage.id,
    vehicleId: vehicle.id,
    workshopId: workshop.id,
    customerId: customer.id,
    estimateId: estimate.id,
    invoiceId: invoice.id,
  };

  return {
    fixtures,
    cleanup: async () => {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      await prisma.$disconnect();
    },
  };
}

const SCENARIOS: Scenario[] = [
  // "auth" — the mobile app has no login call (see src/lib/api/auth.ts's
  // documented interim x-carma-account-id header), so the closest
  // equivalent to a dedicated auth endpoint is GET /account: it exercises
  // exactly the same requireAccount() -> prisma.account.findUnique() ->
  // fire-and-forget lastApiRequestAt update path every other authenticated
  // request also pays for, on the smallest possible payload.
  { name: "auth (account resolution)", method: "GET", path: () => `account`, accountId: (f) => f.accountId },
  { name: "vehicle listing", method: "GET", path: (f) => `vehicles?garageId=${f.garageId}`, accountId: (f) => f.accountId },
  { name: "vehicle timeline", method: "GET", path: (f) => `vehicles/${f.vehicleId}/timeline`, accountId: (f) => f.accountId },
  { name: "dashboard aggregation (vehicle insights)", method: "GET", path: (f) => `vehicles/${f.vehicleId}/insights`, accountId: (f) => f.accountId },
  { name: "workshop job board", method: "GET", path: (f) => `workshops/${f.workshopId}/jobs`, accountId: (f) => f.accountId },
  { name: "estimate retrieval", method: "GET", path: (f) => `estimates/${f.estimateId}`, accountId: (f) => f.accountId },
  { name: "invoice retrieval", method: "GET", path: (f) => `invoices/${f.invoiceId}`, accountId: (f) => f.accountId },
  { name: "notifications", method: "GET", path: () => `notifications`, accountId: (f) => f.accountId },
  {
    name: "vehicle record creation",
    method: "POST",
    path: (f) => `vehicles/${f.vehicleId}/records`,
    body: () => ({ type: "fuel", date: new Date().toISOString(), amount: 500, odometerAtEntry: 1000, enteredByName: "Load Test" }),
    accountId: (f) => f.accountId,
  },
  {
    name: "job creation",
    method: "POST",
    path: (f) => `workshops/${f.workshopId}/jobs`,
    body: (f) => ({ customerId: f.customerId, faultDescription: "Load test job" }),
    accountId: (f) => f.accountId,
  },
  {
    name: "report creation",
    method: "POST",
    path: () => `reports`,
    body: (f) => ({ scope: "GARAGE", scopeId: f.garageId, periodLabel: "Load test" }),
    accountId: (f) => f.accountId,
  },
];

type Result = {
  name: string;
  requestsPerSec: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errors: number;
  timeouts: number;
  non2xx: number;
  totalRequests: number;
};

async function runScenario(scenario: Scenario, fixtures: Fixtures): Promise<Result> {
  const url = `${BASE_URL}/${scenario.path(fixtures)}`;
  const body = scenario.body ? JSON.stringify(scenario.body(fixtures)) : undefined;

  const result = await autocannon({
    url,
    method: scenario.method,
    duration: DURATION_SECONDS,
    connections: CONNECTIONS,
    headers: { "content-type": "application/json", "x-carma-account-id": scenario.accountId(fixtures) },
    body,
    // Idempotency-safe scenarios (record/job/report creation) are fine to
    // hammer repeatedly for a load test — each POST creates a new row, none
    // of them are the retry-sensitive mutations (estimate decision, access
    // grant/revoke) this pass added idempotency keys for specifically
    // because repeating them WOULD be unsafe.
  });

  const non2xx = Object.entries(result.statusCodeStats ?? {})
    .filter(([code]) => Number(code) >= 300)
    .reduce((sum, [, stat]) => sum + (stat.count ?? 0), 0);

  return {
    name: scenario.name,
    requestsPerSec: result.requests.average,
    latencyP50: result.latency.p50,
    latencyP95: result.latency.p97_5 ?? result.latency.p99, // autocannon doesn't report p95 directly; p97_5 is the nearest bucket it exposes
    latencyP99: result.latency.p99,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx,
    totalRequests: result.requests.total,
  };
}

async function main() {
  console.log(`Load test against ${BASE_URL} — ${DURATION_SECONDS}s per scenario, ${CONNECTIONS} connections.`);
  console.log("Setting up fixtures...");
  const { fixtures, cleanup } = await setupFixtures();
  console.log(`Fixtures ready: account=${fixtures.accountId}\n`);

  const results: Result[] = [];
  for (const scenario of SCENARIOS) {
    console.log(`Running: ${scenario.name}...`);
    try {
      const result = await runScenario(scenario, fixtures);
      results.push(result);
      console.log(
        `  req/s=${result.requestsPerSec.toFixed(1)} p50=${result.latencyP50}ms p95=${result.latencyP95}ms p99=${result.latencyP99}ms errors=${result.errors} non2xx=${result.non2xx}/${result.totalRequests}`,
      );
    } catch (error) {
      console.error(`  FAILED: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log("\n=== Summary (dev-environment measurements — not a production capacity claim) ===");
  console.log(
    ["scenario", "req/s", "p50 (ms)", "p95 (ms)", "p99 (ms)", "errors", "non-2xx", "total"].join("\t"),
  );
  for (const r of results) {
    console.log(
      [
        r.name,
        r.requestsPerSec.toFixed(1),
        r.latencyP50,
        r.latencyP95,
        r.latencyP99,
        r.errors,
        r.non2xx,
        r.totalRequests,
      ].join("\t"),
    );
  }

  console.log("\nCleaning up fixtures...");
  await cleanup();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
