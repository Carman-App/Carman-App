import type { NextRequest } from "next/server";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { getVehicleTimeline } from "@/lib/records";

// GET /api/v1/vehicles/:id/timeline — merged, reverse-chronological view
// across all five record types plus documents. Paginated the same way as
// vehicles/:id/records, paginated in the database (see getVehicleTimeline).
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
    const { items, total } = await getVehicleTimeline(vehicleId, skip, take);
    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}
