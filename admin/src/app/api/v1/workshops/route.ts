import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createWorkshopSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { parsePagination } from "@/lib/api/pagination";
import { WorkshopRole } from "@/generated/prisma/enums";

// GET /api/v1/workshops — workshops the caller owns or is staff at. Paginated
// for consistency with every other /api/v1/* list endpoint (AGENTS.md
// scalability pass, section 4) even though in practice bounded to a handful
// per account today.
// Chain: auth -> account -> query.
export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const { page, pageSize, skip, take } = parsePagination(req);

    const where = {
      OR: [{ ownerId: account.id }, { members: { some: { accountId: account.id } } }],
    };
    const [workshops, total] = await Promise.all([
      prisma.workshop.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.workshop.count({ where }),
    ]);

    return apiOkPaginated(workshops, { page, pageSize, total });
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
