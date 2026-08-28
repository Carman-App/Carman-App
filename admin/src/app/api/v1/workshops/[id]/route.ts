import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// GET /api/v1/workshops/:id
// Chain: auth -> account -> membership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    await requireWorkshopMembership(account.id, id);

    const workshop = await prisma.workshop.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!workshop) {
      throw new NotFoundError("Workshop not found.");
    }

    return apiOk(workshop);
  } catch (error) {
    return handleApiError(error);
  }
}
