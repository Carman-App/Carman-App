import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { createJobLineSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { JobLineKind } from "@/generated/prisma/enums";

// POST /api/v1/jobs/:id/lines — add a labour/part/service/fluid line item.
// Chain: auth -> account -> resolve job -> workshop membership -> validate -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: jobId } = await params;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundError("Job not found.");
    }
    await requireWorkshopMembership(account.id, job.workshopId);

    const body = await req.json().catch(() => null);
    const parsed = createJobLineSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid job line payload.", parsed.error.flatten());
    }

    const line = await prisma.jobLine.create({
      data: {
        jobId,
        kind: parsed.data.kind as JobLineKind | undefined,
        description: parsed.data.description,
        cost: parsed.data.cost,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "job.line.create",
      entityType: "JobLine",
      entityId: line.id,
      metadata: { jobId },
    });

    return apiOk(line, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
