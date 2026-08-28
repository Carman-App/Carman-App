import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { createStagePartSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

// POST /api/v1/stages/:id/parts — a part purchase attached to a project
// build stage (Part is shared with vehicle-level part purchases via a
// nullable vehicleId, see schema.prisma; this always sets stageId only).
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
    const parsed = createStagePartSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid part payload.", parsed.error.flatten());
    }

    const [part] = await prisma.$transaction([
      prisma.part.create({
        data: {
          stageId,
          name: parsed.data.name,
          cost: parsed.data.cost,
          supplier: parsed.data.supplier,
          date: parsed.data.date ? new Date(parsed.data.date) : undefined,
        },
      }),
      prisma.project.update({
        where: { id: stage.project.id },
        data: { spent: { increment: parsed.data.cost } },
      }),
    ]);

    await writeAuditLog({
      actorId: account.id,
      action: "project.stage.part.create",
      entityType: "Part",
      entityId: part.id,
      metadata: { stageId },
    });

    return apiOk(part, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
