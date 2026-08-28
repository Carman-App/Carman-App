import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit";

// POST /api/v1/access-grants/:id/revoke — owner ends a workshop's visibility
// into a vehicle's history immediately (before its natural expiresAt).
// Chain: auth -> account -> resolve grant -> vehicle ownership -> state check -> update -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const grant = await prisma.accessGrant.findUnique({ where: { id } });
    if (!grant) {
      throw new NotFoundError("Access grant not found.");
    }
    await requireVehicleAccess(account.id, grant.vehicleId);

    if (grant.revokedAt) {
      throw new ConflictError("This access grant was already revoked.");
    }

    const updated = await prisma.accessGrant.update({
      where: { id },
      data: { revokedAt: new Date(), revokedByAccountId: account.id },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "access_grant.revoke",
      entityType: "AccessGrant",
      entityId: id,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
