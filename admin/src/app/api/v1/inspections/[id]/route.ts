import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// GET /api/v1/inspections/:id
// Chain: auth -> account -> resolve inspection -> membership/ownership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: { items: true, workshop: { select: { id: true, name: true } } },
    });
    if (!inspection) {
      throw new NotFoundError("Inspection not found.");
    }
    await requireVehicleAccess(account.id, inspection.vehicleId);

    return apiOk(inspection);
  } catch (error) {
    return handleApiError(error);
  }
}
