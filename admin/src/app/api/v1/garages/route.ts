import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createGarageSchema } from "@/lib/api/schemas";
import { assertCanCreateGarage } from "@/lib/limits";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination } from "@/lib/api/pagination";
import { GarageRole } from "@/generated/prisma/enums";

// GET /api/v1/garages — garages the caller owns or belongs to. In practice
// bounded by plan limits (a handful per account), but paginated anyway for
// consistency with every other /api/v1/* list endpoint (AGENTS.md
// scalability pass, section 4) and so a future no-limit plan can't produce
// an unbounded response.
export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const { page, pageSize, skip, take } = parsePagination(req);

    const where = {
      OR: [{ ownerId: account.id }, { members: { some: { accountId: account.id } } }],
    };
    const [garages, total] = await Promise.all([
      prisma.garage.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.garage.count({ where }),
    ]);

    return apiOkPaginated(garages, { page, pageSize, total });
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
