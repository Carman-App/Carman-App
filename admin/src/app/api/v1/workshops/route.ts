import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createWorkshopSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { WorkshopRole } from "@/generated/prisma/enums";

// GET /api/v1/workshops — workshops the caller owns or is staff at.
// Chain: auth -> account -> query.
export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const workshops = await prisma.workshop.findMany({
      where: {
        OR: [{ ownerId: account.id }, { members: { some: { accountId: account.id } } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return apiOk(workshops);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/workshops — create a workshop owned by the caller.
// Chain: auth -> account -> validate -> create -> audit log.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const body = await req.json().catch(() => null);
    const parsed = createWorkshopSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid workshop payload.", parsed.error.flatten());
    }

    const workshop = await prisma.workshop.create({
      data: {
        name: parsed.data.name,
        ownerId: account.id,
        members: {
          create: {
            accountId: account.id,
            role: WorkshopRole.OWNER,
            displayName: account.user.name,
          },
        },
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "workshop.create",
      entityType: "Workshop",
      entityId: workshop.id,
    });

    return apiOk(workshop, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
