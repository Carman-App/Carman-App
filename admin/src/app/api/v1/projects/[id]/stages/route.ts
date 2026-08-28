import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { createStageSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import type { BuildStageStatus } from "@/generated/prisma/enums";

async function loadProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { vehicleId: true } });
  if (!project) throw new NotFoundError("Project not found.");
  return project;
}

// GET /api/v1/projects/:id/stages — a project's build usually has few
// enough stages that pagination isn't needed; returns them all, ordered.
// Chain: auth -> account -> resolve project -> membership/ownership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: projectId } = await params;

    const project = await loadProject(projectId);
    await requireVehicleAccess(account.id, project.vehicleId);

    const stages = await prisma.projectStage.findMany({
      where: { projectId },
      include: { modifications: true, parts: true },
      orderBy: { createdAt: "asc" },
    });

    return apiOk(stages);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/projects/:id/stages
// Chain: auth -> account -> resolve project -> membership/ownership -> validate -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: projectId } = await params;

    const project = await loadProject(projectId);
    await requireVehicleAccess(account.id, project.vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = createStageSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid stage payload.", parsed.error.flatten());
    }

    const stage = await prisma.projectStage.create({
      data: {
        projectId,
        name: parsed.data.name,
        status: parsed.data.status as BuildStageStatus | undefined,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "project.stage.create",
      entityType: "ProjectStage",
      entityId: stage.id,
      metadata: { projectId },
    });

    return apiOk(stage, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
