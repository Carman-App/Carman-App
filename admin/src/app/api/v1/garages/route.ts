import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createGarageSchema } from "@/lib/api/schemas";
import { assertCanCreateGarage } from "@/lib/limits";
import { writeAuditLog } from "@/lib/audit";
import { GarageRole } from "@/generated/prisma/enums";

// GET /api/v1/garages — garages the caller owns or belongs to.
export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const garages = await prisma.garage.findMany({
      where: {
        OR: [{ ownerId: account.id }, { members: { some: { accountId: account.id } } }],
      },
      orderBy: { createdAt: "desc" },
    });

    return apiOk(garages);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/garages — create a garage owned by the caller.
// Chain: auth -> account -> plan limit -> validate -> create -> audit log.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const body = await req.json().catch(() => null);
    const parsed = createGarageSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid garage payload.", parsed.error.flatten());
    }

    await assertCanCreateGarage(account.id);

    const garage = await prisma.garage.create({
      data: {
        name: parsed.data.name,
        location: parsed.data.location,
        ownerId: account.id,
        members: {
          create: {
            accountId: account.id,
            role: GarageRole.OWNER,
            displayName: account.user.name,
          },
        },
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "garage.create",
      entityType: "Garage",
      entityId: garage.id,
    });

    return apiOk(garage, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
