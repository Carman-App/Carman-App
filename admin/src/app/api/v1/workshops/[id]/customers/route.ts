import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { createWorkshopCustomerSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";

// GET /api/v1/workshops/:id/customers — paginated.
// Chain: auth -> account -> membership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: workshopId } = await params;

    await requireWorkshopMembership(account.id, workshopId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const where = { workshopId };
    const [items, total] = await Promise.all([
      prisma.workshopCustomer.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.workshopCustomer.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/workshops/:id/customers
// Chain: auth -> account -> membership -> validate -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: workshopId } = await params;

    await requireWorkshopMembership(account.id, workshopId);

    const body = await req.json().catch(() => null);
    const parsed = createWorkshopCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid customer payload.", parsed.error.flatten());
    }

    const customer = await prisma.workshopCustomer.create({
      data: { workshopId, ...parsed.data },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "workshop.customer.create",
      entityType: "WorkshopCustomer",
      entityId: customer.id,
    });

    return apiOk(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
