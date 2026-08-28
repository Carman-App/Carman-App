import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// GET /api/v1/estimates/:id — owner-side read view.
// Chain: auth -> account -> resolve estimate -> membership/ownership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const estimate = await prisma.estimate.findUnique({
      where: { id },
      include: {
        items: true,
        decisions: { orderBy: { decidedAt: "desc" } },
        workshop: { select: { id: true, name: true } },
      },
    });
    if (!estimate) {
      throw new NotFoundError("Estimate not found.");
    }
    await requireVehicleAccess(account.id, estimate.vehicleId);

    return apiOk(estimate);
  } catch (error) {
    return handleApiError(error);
  }
}
