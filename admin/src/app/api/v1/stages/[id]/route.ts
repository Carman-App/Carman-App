import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateStageSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { BuildStageStatus } from "@/generated/prisma/enums";

async function loadStage(id: string) {
  const stage = await prisma.projectStage.findUnique({
    where: { id },
    include: { project: { select: { vehicleId: true } } },
  });
  if (!stage) throw new NotFoundError("Project stage not found.");
  return stage;
}

// PATCH /api/v1/stages/:id
// Chain: auth -> account -> resolve stage/project/vehicle -> membership/ownership -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const stage = await loadStage(id);
    await requireVehicleAccess(account.id, stage.project.vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = updateStageSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid stage payload.", parsed.error.flatten());
    }

    const updated = await prisma.projectStage.update({
      where: { id },
      data: {
        name: parsed.data.name,
        status: parsed.data.status as BuildStageStatus | undefined,
      },
      include: { modifications: true, parts: true },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "project.stage.update",
      entityType: "ProjectStage",
      entityId: id,
      metadata: parsed.data,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
