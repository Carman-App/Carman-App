import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopRole } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { updateJobStatusSchema } from "@/lib/api/schemas";
import { assertJobTransition } from "@/lib/jobs/state-machine";
import { writeAuditLog } from "@/lib/audit";
import { JobStatus, WorkshopRole } from "@/generated/prisma/enums";

// POST /api/v1/jobs/:id/status
// Chain: auth -> account -> workshop role -> resource -> validated
// transition (src/lib/jobs/state-machine.ts) -> permission -> update -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: jobId } = await params;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return apiError(404, "NOT_FOUND", "Job not found.");
    }

    // Front desk and apprentices can't move a job through its lifecycle —
    // only the workshop owner or an assigned mechanic can.
    await requireWorkshopRole(account.id, job.workshopId, [
      WorkshopRole.OWNER,
      WorkshopRole.MECHANIC,
    ]);

    const body = await req.json().catch(() => null);
    const parsed = updateJobStatusSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid status payload.", parsed.error.flatten());
    }

    const nextStatus = parsed.data.status as JobStatus;
    assertJobTransition(job.status, nextStatus);

    // WORK-05 needs real "time entered this state" history to compute median
    // age per state — record every transition here (nothing else in this
    // codebase writes JobStatusEvent yet). Job.status update and the event
    // row are written together so the history can never drift from the
    // cached current status.
    const [updated] = await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: { status: nextStatus },
      }),
      prisma.jobStatusEvent.create({
        data: {
          jobId: job.id,
          fromStatus: job.status,
          toStatus: nextStatus,
          changedByAccountId: account.id,
        },
      }),
    ]);

    await writeAuditLog({
      actorId: account.id,
      action: "job.status_change",
      entityType: "Job",
      entityId: job.id,
      metadata: { from: job.status, to: nextStatus },
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
