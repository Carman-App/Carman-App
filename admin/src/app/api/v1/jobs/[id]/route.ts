import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateJobSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

async function loadJob(id: string) {
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) throw new NotFoundError("Job not found.");
  return job;
}

// GET /api/v1/jobs/:id
// Chain: auth -> account -> resolve job -> workshop membership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const job = await loadJob(id);
    await requireWorkshopMembership(account.id, job.workshopId);

    const full = await prisma.job.findUnique({
      where: { id },
      include: { customer: true, lines: true, assignments: { include: { workshopMember: true } } },
    });

    return apiOk(full);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/v1/jobs/:id — edits the job's own descriptive fields. Status
// changes go through the dedicated state-machine-checked
// /api/v1/jobs/:id/status route, not this one.
// Chain: auth -> account -> resolve job -> workshop membership -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const job = await loadJob(id);
    await requireWorkshopMembership(account.id, job.workshopId);

    const body = await req.json().catch(() => null);
    const parsed = updateJobSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid job payload.", parsed.error.flatten());
    }

    const updated = await prisma.job.update({ where: { id }, data: parsed.data });

    await writeAuditLog({
      actorId: account.id,
      action: "job.update",
      entityType: "Job",
      entityId: id,
      metadata: parsed.data,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
