import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { syncVehicleReminders } from "@/lib/reminders/sync";

// GET /api/v1/vehicles/:id/reminders — paginated. ?resolved=true to include
// resolved reminders too (default: unresolved only).
// Chain: auth -> account -> membership/ownership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    // Reconcile against live data before reading — see @/lib/reminders/sync's
    // module doc for why this happens here instead of a cron job.
    await syncVehicleReminders(vehicleId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const includeResolved = req.nextUrl.searchParams.get("resolved") === "true";
    const where = includeResolved ? { vehicleId } : { vehicleId, resolved: false };

    const [items, total] = await Promise.all([
      prisma.reminder.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.reminder.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}
