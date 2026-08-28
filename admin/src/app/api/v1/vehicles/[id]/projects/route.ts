import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { createProjectSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

// GET /api/v1/vehicles/:id/projects — paginated.
// Chain: auth -> account -> membership/ownership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const where = { vehicleId };
    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { stages: { include: { modifications: true, parts: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.project.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/vehicles/:id/projects
// Chain: auth -> account -> membership/ownership -> validate -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const body = await req.json().catch(() => null);
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid project payload.", parsed.error.flatten());
    }

    const project = await prisma.project.create({
      data: { vehicleId, name: parsed.data.name, budget: parsed.data.budget },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "project.create",
      entityType: "Project",
      entityId: project.id,
    });

    return apiOk(project, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
