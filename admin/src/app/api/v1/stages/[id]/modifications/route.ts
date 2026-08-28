import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { createModificationSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

// POST /api/v1/stages/:id/modifications
// Chain: auth -> account -> resolve stage/project/vehicle -> membership/ownership -> validate -> create (+ bump project.spent) -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: stageId } = await params;

    const stage = await prisma.projectStage.findUnique({
      where: { id: stageId },
      include: { project: { select: { id: true, vehicleId: true } } },
    });
    if (!stage) {
      throw new NotFoundError("Project stage not found.");
    }
    await requireVehicleAccess(account.id, stage.project.vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = createModificationSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid modification payload.", parsed.error.flatten());
    }

    const [modification] = await prisma.$transaction([
      prisma.modification.create({
        data: { stageId, name: parsed.data.name, cost: parsed.data.cost },
      }),
      prisma.project.update({
        where: { id: stage.project.id },
        data: { spent: { increment: parsed.data.cost } },
      }),
    ]);

    await writeAuditLog({
      actorId: account.id,
      action: "project.stage.modification.create",
      entityType: "Modification",
      entityId: modification.id,
      metadata: { stageId },
    });

    return apiOk(modification, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
