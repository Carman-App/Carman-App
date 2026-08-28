import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateProjectSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

async function loadProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { stages: { include: { modifications: true, parts: true } } },
  });
  if (!project) throw new NotFoundError("Project not found.");
  return project;
}

// GET /api/v1/projects/:id
// Chain: auth -> account -> resolve project -> membership/ownership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const project = await loadProject(id);
    await requireVehicleAccess(account.id, project.vehicleId);

    return apiOk(project);
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/v1/projects/:id
// Chain: auth -> account -> resolve project -> membership/ownership -> validate -> update -> audit log.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const project = await loadProject(id);
    await requireVehicleAccess(account.id, project.vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid project payload.", parsed.error.flatten());
    }

    const updated = await prisma.project.update({
      where: { id },
      data: parsed.data,
      include: { stages: { include: { modifications: true, parts: true } } },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "project.update",
      entityType: "Project",
      entityId: id,
      metadata: parsed.data,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
