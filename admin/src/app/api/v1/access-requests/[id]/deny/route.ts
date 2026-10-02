import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit";
import { AccessRequestStatus } from "@/generated/prisma/enums";
import { withIdempotency, resolveIdempotencyKey } from "@/lib/idempotency";

// POST /api/v1/access-requests/:id/deny
// Chain: auth -> account -> resolve request -> vehicle ownership -> state check -> update -> audit log.
// Idempotent: see access-requests/[id]/approve/route.ts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const { status, body } = await withIdempotency(
      { scope: "access_request.deny", key: resolveIdempotencyKey(req, id), accountId: account.id },
      async () => {
        const accessRequest = await prisma.accessRequest.findUnique({ where: { id } });
        if (!accessRequest) {
          throw new NotFoundError("Access request not found.");
        }
        await requireVehicleAccess(account.id, accessRequest.vehicleId);

        if (accessRequest.status !== AccessRequestStatus.PENDING) {
          throw new ConflictError(`This access request was already ${accessRequest.status.toLowerCase()}.`);
        }

        const updated = await prisma.accessRequest.update({
          where: { id },
          data: { status: AccessRequestStatus.DENIED, respondedAt: new Date() },
        });

        await writeAuditLog({
          actorId: account.id,
          action: "access_request.deny",
          entityType: "AccessRequest",
          entityId: id,
        });

        return { status: 200, body: updated };
      },
    );

    return apiOk(body, status);
  } catch (error) {
    return handleApiError(error);
  }
}
