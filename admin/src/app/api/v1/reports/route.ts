import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership, requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createReportSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { ReportScope } from "@/generated/prisma/enums";
import { withIdempotency, resolveIdempotencyKey, hashRequest } from "@/lib/idempotency";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { enqueueJob } from "@/lib/queue/queue";
import { withApiLogging } from "@/lib/api/withLogging";

// POST /api/v1/reports — request a report scoped to a vehicle or a garage
// for a period. This is async per AGENTS.md section 10 (report generation
// must never be a synchronous expensive query on the request path): the
// route creates the Report row and enqueues a "report.generate" background
// job, then returns immediately with status "queued" (see
// src/lib/reports/status.ts / scripts/queue-worker.ts for the consumer).
// Actual PDF/file rendering is still out of scope for this codebase (no PDF
// library or storage credential-backed renderer exists — see
// src/lib/storage.ts); the worker marks the job/report complete without
// producing a real file, same honest gap as before this pass, but now
// through the real async lifecycle instead of pretending it was synchronous.
// Chain: auth -> account -> vehicle/garage membership (per scope) -> rate limit -> idempotency -> validate -> create + enqueue -> audit log.
// Wrapped with structured request logging — report creation is load-tested
// (section 21).
export const POST = withApiLogging("reports.create", async (req: NextRequest) => {
  try {
    const account = await requireAccount(req);
    await enforceRateLimit(RATE_LIMITS.REPORT_GENERATE, `account:${account.id}`);

    const body = await req.json().catch(() => null);
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid report payload.", parsed.error.flatten());
    }
    const input = parsed.data;

    if (input.scope === ReportScope.VEHICLE) {
      await requireVehicleAccess(account.id, input.scopeId);
    } else {
      await requireGarageMembership(account.id, input.scopeId);
    }

    const { status, body: responseBody } = await withIdempotency(
      {
        scope: "report.generate",
        key: resolveIdempotencyKey(req, `${account.id}:${input.scope}:${input.scopeId}:${input.periodLabel}`),
        accountId: account.id,
        requestHash: hashRequest(input),
      },
      async () => {
        const report = await prisma.report.create({
          data: {
            scope: input.scope as ReportScope,
            scopeId: input.scopeId,
            periodLabel: input.periodLabel,
            generatedByAccountId: account.id,
            recipients: input.recipients
              ? { create: input.recipients.map((r) => ({ email: r.email, name: r.name })) }
              : undefined,
          },
          include: { recipients: true },
        });

        const job = await enqueueJob(
          "report.generate",
          { reportId: report.id, scope: input.scope, scopeId: input.scopeId },
          { dedupeKey: `report.generate:${report.id}` },
        );

        await writeAuditLog({
          actorId: account.id,
          action: "report.generate",
          entityType: "Report",
          entityId: report.id,
          metadata: { scope: input.scope, scopeId: input.scopeId, jobId: job.id },
        });

        return { status: 202, body: { ...report, jobId: job.id, jobStatus: job.status } };
      },
    );

    return apiOk(responseBody, status);
  } catch (error) {
    return handleApiError(error);
  }
});
