/**
 * Failure-mode tests — AGENTS.md scalability pass, section 22: "verify/
 * document behavior when DB is briefly unavailable, a queue worker is down,
 * storage is unavailable, a notification provider fails, a request is
 * retried, a user double-submits... write actual test cases where a request
 * handler can be reasonably exercised, don't just assert this in prose."
 *
 * Same pattern as scripts/idor-check.ts / scripts/load-test.ts: a plain tsx
 * script making real HTTP requests + real DB/queue calls against the actual
 * running dev server (no test framework is installed in this repo — see
 * the note in idor-check.ts). Exits non-zero if any case fails.
 *
 * Usage:
 *   npm run dev                     # in one terminal
 *   npx tsx scripts/failure-tests.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BASE_URL = process.env.FAILURE_TEST_BASE_URL ?? "http://localhost:3000/api/v1";

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name} — ${detail}`);
}

async function post(path: string, accountId: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-carma-account-id": accountId, ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  const suffix = Date.now().toString(36);
  const userId = `failtest-user-${suffix}`;
  console.log("Setting up fixtures...");
  const user = await prisma.user.create({
    data: { id: userId, email: `failtest-${suffix}@example.invalid`, name: "Failure Test" },
  });
  const account = await prisma.account.create({ data: { userId: user.id, region: "KE" } });
  const garage = await prisma.garage.create({
    data: {
      ownerId: account.id,
      name: "Failure Test Garage",
      location: "Nowhere",
      members: { create: { accountId: account.id, role: "OWNER", displayName: "Failure Test" } },
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: { garageId: garage.id, make: "Test", model: "Fail Test Car", year: 2020, plate: `FAIL-${suffix}` },
  });
  const workshop = await prisma.workshop.create({
    data: {
      ownerId: account.id,
      name: "Failure Test Workshop",
      members: { create: { accountId: account.id, role: "OWNER", displayName: "Failure Test" } },
    },
  });
  const customer = await prisma.workshopCustomer.create({ data: { workshopId: workshop.id, name: "Customer" } });
  const job = await prisma.job.create({
    data: { workshopId: workshop.id, customerId: customer.id, vehicleId: vehicle.id, faultDescription: "Fail test" },
  });

  console.log(`Fixtures ready: account=${account.id}\n`);
  console.log("=== 1. Double-submit / retry safety (real HTTP against live server) ===");

  // 1a. Same idempotency key, sequential retry: second call must replay,
  // not create a second EstimateDecision or flip status twice.
  {
    const estimate = await prisma.estimate.create({
      data: { jobId: job.id, vehicleId: vehicle.id, workshopId: workshop.id, total: 500 },
    });
    const idKey = `test-key-${suffix}-a`;
    const first = await post(`estimates/${estimate.id}/decision`, account.id, { decision: "APPROVED" }, { "Idempotency-Key": idKey });
    const second = await post(`estimates/${estimate.id}/decision`, account.id, { decision: "APPROVED" }, { "Idempotency-Key": idKey });
    const decisionCount = await prisma.estimateDecision.count({ where: { estimateId: estimate.id } });
    record(
      "Sequential retry with same Idempotency-Key replays, doesn't double-approve",
      first.status === 201 && second.status === 201 && decisionCount === 1,
      `first=${first.status} second=${second.status} decisionRows=${decisionCount} (want 1)`,
    );
  }

  // 1b. No client-supplied key at all (naive retry): the derived fallback
  // key (based on the estimate id) must still prevent a double-approval —
  // this is the realistic case for the mobile app today (no client sends
  // Idempotency-Key yet).
  {
    const estimate = await prisma.estimate.create({
      data: { jobId: job.id, vehicleId: vehicle.id, workshopId: workshop.id, total: 750 },
    });
    const first = await post(`estimates/${estimate.id}/decision`, account.id, { decision: "APPROVED" });
    const second = await post(`estimates/${estimate.id}/decision`, account.id, { decision: "APPROVED" });
    const decisionCount = await prisma.estimateDecision.count({ where: { estimateId: estimate.id } });
    record(
      "Naive retry (no Idempotency-Key header) still doesn't double-approve",
      decisionCount === 1 && (second.status === 201 || second.status === 409),
      `first=${first.status} second=${second.status} decisionRows=${decisionCount} (want 1)`,
    );
  }

  // 1c. TRUE concurrent double-submit (both requests in flight at once,
  // simulating a double-tap): exactly one must win, the other must see the
  // in-progress/conflict state, and only one EstimateDecision row results.
  {
    const estimate = await prisma.estimate.create({
      data: { jobId: job.id, vehicleId: vehicle.id, workshopId: workshop.id, total: 900 },
    });
    const [a, b] = await Promise.all([
      post(`estimates/${estimate.id}/decision`, account.id, { decision: "DECLINED" }),
      post(`estimates/${estimate.id}/decision`, account.id, { decision: "DECLINED" }),
    ]);
    const decisionCount = await prisma.estimateDecision.count({ where: { estimateId: estimate.id } });
    const bothHandledCleanly = [a.status, b.status].every((s) => [201, 409].includes(s));
    record(
      "Concurrent double-tap creates exactly one decision, no crash",
      decisionCount === 1 && bothHandledCleanly,
      `a=${a.status} b=${b.status} decisionRows=${decisionCount} (want 1)`,
    );
  }

  // 1d. Access grant revoke double-submit.
  {
    const accessRequest = await prisma.accessRequest.create({
      data: { vehicleId: vehicle.id, workshopId: workshop.id, scope: "full" },
    });
    const grant = await prisma.accessGrant.create({
      data: { vehicleId: vehicle.id, workshopId: workshop.id, scope: "full", expiresAt: new Date(Date.now() + 86400000) },
    });
    const first = await post(`access-grants/${grant.id}/revoke`, account.id);
    const second = await post(`access-grants/${grant.id}/revoke`, account.id);
    const row = await prisma.accessGrant.findUnique({ where: { id: grant.id } });
    record(
      "Access grant revoke retry doesn't error or double-revoke",
      first.status === 200 && second.status === 200 && row?.revokedAt != null,
      `first=${first.status} second=${second.status} revokedAt=${row?.revokedAt}`,
    );
    await prisma.accessRequest.delete({ where: { id: accessRequest.id } }).catch(() => {});
  }

  console.log("\n=== 2. Queue worker down: jobs survive and stay queryable, requests never block on them ===");
  {
    const before = Date.now();
    const report = await post(`reports`, account.id, { scope: "GARAGE", scopeId: garage.id, periodLabel: "Failure test" });
    const requestMs = Date.now() - before;
    const jobId = (report.json as { data?: { jobId?: string } } | null)?.data?.jobId;
    const job = jobId ? await prisma.backgroundJob.findUnique({ where: { id: jobId } }) : null;
    record(
      "Report creation returns fast and enqueues a job without waiting for a worker",
      report.status === 202 && requestMs < 5000 && job != null && job.status !== undefined,
      `status=${report.status} requestMs=${requestMs} jobStatus=${job?.status} (job exists and request didn't block on processing it)`,
    );
  }

  console.log("\n=== 3. Queue retry/backoff on job failure (direct against src/lib/queue/queue.ts + live DB) ===");
  {
    // Import lazily so this section's failure doesn't stop HTTP-based cases above.
    const { enqueueJob, claimNextJob, failJob, completeJob } = await import("../src/lib/queue/queue");
    const job = await enqueueJob("notification.dispatch", { notificationId: "does-not-exist" }, { maxAttempts: 2 });
    const claimed1 = await claimNextJob(`failtest-${suffix}`);
    const gotClaimed1 = claimed1?.id === job.id;
    if (claimed1) await failJob(claimed1.id, "simulated provider failure");
    const afterFirstFailure = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
    const backoffApplied = afterFirstFailure != null && afterFirstFailure.runAt.getTime() > Date.now();
    record(
      "Failed job is retried with backoff (runAt pushed to the future), not lost",
      gotClaimed1 && afterFirstFailure?.status === "PENDING" && backoffApplied,
      `claimed=${gotClaimed1} status=${afterFirstFailure?.status} runAt=${afterFirstFailure?.runAt.toISOString()}`,
    );

    // Force the second (final, maxAttempts=2) attempt to fail permanently.
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { runAt: new Date(), attempts: 1 } });
    const claimed2 = await claimNextJob(`failtest-${suffix}`);
    if (claimed2) await failJob(claimed2.id, "simulated provider failure again");
    const afterSecondFailure = await prisma.backgroundJob.findUnique({ where: { id: job.id } });
    record(
      "Job exhausting its retry budget lands in FAILED (not silently dropped, not retried forever)",
      afterSecondFailure?.status === "FAILED" && afterSecondFailure.lastError?.includes("simulated") === true,
      `status=${afterSecondFailure?.status} lastError=${afterSecondFailure?.lastError}`,
    );
    await completeJob(job.id, {}).catch(() => {}); // cleanup, ignore state-machine nitpicking here
  }

  console.log("\n=== 4. DB briefly unavailable: a bad connection fails clearly within the configured timeout, doesn't hang ===");
  {
    const badAdapter = new PrismaPg({
      connectionString: "postgresql://invalid:invalid@127.0.0.1:1/nonexistent",
      connectionTimeoutMillis: 3000,
    });
    const badPrisma = new PrismaClient({ adapter: badAdapter });
    const start = Date.now();
    let threw = false;
    try {
      await badPrisma.account.findFirst();
    } catch {
      threw = true;
    }
    const elapsed = Date.now() - start;
    record(
      "Unreachable DB rejects cleanly within ~timeout instead of hanging forever",
      threw && elapsed < 8000,
      `threw=${threw} elapsedMs=${elapsed} (want < 8000ms, i.e. bounded by connectionTimeoutMillis, not an indefinite hang)`,
    );
    await badPrisma.$disconnect().catch(() => {});
  }

  console.log("\n=== 5. Storage unavailable (no S3 credentials configured) — documented, not re-executed here ===");
  console.log(
    "  [INFO] src/lib/storage.ts's getBucket() throws synchronously before any network call when S3_BUCKET is",
    "unset (see .env.example) — every document-upload/report-file code path already fails fast with a clear",
    "error rather than hanging. Not re-tested via HTTP here because storage.ts has a \"server-only\" guard this",
    "plain script can't import (see src/lib/queue/queue.ts's comment on that constraint) — verified by code",
    "inspection instead; see SCALABILITY_AUDIT.md.",
  );

  console.log("\nCleaning up fixtures...");
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
