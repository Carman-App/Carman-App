import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership } from "@/lib/api/authorize";
import { apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";

// GET /api/v1/garages/:id/reminders — reminders across every vehicle in the
// garage, paginated. ?resolved=true to include resolved reminders too.
// Chain: auth -> account -> membership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: garageId } = await params;

    await requireGarageMembership(account.id, garageId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const includeResolved = req.nextUrl.searchParams.get("resolved") === "true";
    const where = includeResolved
      ? { vehicle: { garageId } }
      : { vehicle: { garageId }, resolved: false };

    const [items, total] = await Promise.all([
      prisma.reminder.findMany({
        where,
        include: { vehicle: { select: { id: true, make: true, model: true, plate: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.reminder.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}
