import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { approveAccessRequestSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { AccessRequestStatus } from "@/generated/prisma/enums";
import { withIdempotency, resolveIdempotencyKey, hashRequest } from "@/lib/idempotency";

const DEFAULT_GRANT_DAYS = 30;

// POST /api/v1/access-requests/:id/approve — owner turns a pending request
// into a live AccessGrant.
// Chain: auth -> account -> resolve request -> vehicle ownership -> state check -> validate -> create grant + update request -> audit log.
// Idempotent: a retried/double-submitted approval (same derived or
// client-supplied key) replays the original grant instead of creating a
// second one — see src/lib/idempotency.ts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = approveAccessRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid approval payload.", parsed.error.flatten());
    }

    const { status, body: responseBody } = await withIdempotency(
      {
        scope: "access_request.approve",
        key: resolveIdempotencyKey(req, id),
        accountId: account.id,
        requestHash: hashRequest(parsed.data),
      },
      async () => {
        const accessRequest = await prisma.accessRequest.findUnique({ where: { id } });
        if (!accessRequest) {
          throw new NotFoundError("Access request not found.");
        }
        await requireVehicleAccess(account.id, accessRequest.vehicleId);

        if (accessRequest.status !== AccessRequestStatus.PENDING) {
          throw new ConflictError(`This access request was already ${accessRequest.status.toLowerCase()}.`);
        }

        const expiresInDays = parsed.data.expiresInDays ?? DEFAULT_GRANT_DAYS;
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

        const [, grant] = await prisma.$transaction([
          prisma.accessRequest.update({
            where: { id },
            data: { status: AccessRequestStatus.APPROVED, respondedAt: new Date() },
          }),
          prisma.accessGrant.create({
            data: {
              accessRequestId: id,
              vehicleId: accessRequest.vehicleId,
              workshopId: accessRequest.workshopId,
              approvedByAccountId: account.id,
              scope: parsed.data.scope ?? accessRequest.scope,
              expiresAt,
            },
          }),
        ]);

        await writeAuditLog({
          actorId: account.id,
          action: "access_request.approve",
          entityType: "AccessGrant",
          entityId: grant.id,
          metadata: { accessRequestId: id },
        });

        return { status: 201, body: grant };
      },
    );

    return apiOk(responseBody, status);
  } catch (error) {
    return handleApiError(error);
  }
}
