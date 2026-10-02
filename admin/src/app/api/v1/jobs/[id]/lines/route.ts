import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopRole } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { createJobLineSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { WorkshopRole, type JobLineKind } from "@/generated/prisma/enums";

// POST /api/v1/jobs/:id/lines — add a labour/part/service/fluid line item.
// Chain: auth -> account -> resolve job -> workshop role -> validate -> create -> audit log.
//
// Role note (product spec, "the bench" / APPRENTICE): a job line always
// carries a price (`cost`), so this is a pricing action — an apprentice
// "contributes to jobs WITHOUT OWNING PRICING" and must not be able to set
// one, even indirectly by adding a priced line. Restricted to the roles that
// are allowed to own pricing: owner, mechanic, front desk.
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
    await requireWorkshopRole(account.id, job.workshopId, [
      WorkshopRole.OWNER,
      WorkshopRole.MECHANIC,
      WorkshopRole.FRONTDESK,
    ]);

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
