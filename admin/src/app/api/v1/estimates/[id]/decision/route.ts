import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { estimateDecisionSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { EstimateStatus, type EstimateDecisionType } from "@/generated/prisma/enums";

// POST /api/v1/estimates/:id/decision — approve or decline. Records an
// EstimateDecision row (history) and sets Estimate.status; never mutates an
// approved estimate's line items — a revised estimate is a new Estimate row
// (out of scope here, workshop-side), not an edit of this one. Only valid
// while the estimate is still PENDING.
// Chain: auth -> account -> resolve estimate -> membership/ownership -> state check -> validate -> create decision + update status -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const estimate = await prisma.estimate.findUnique({ where: { id } });
    if (!estimate) {
      throw new NotFoundError("Estimate not found.");
    }
    await requireVehicleAccess(account.id, estimate.vehicleId);

    if (estimate.status !== EstimateStatus.PENDING) {
      throw new ConflictError(`This estimate was already ${estimate.status.toLowerCase()}.`);
    }

    const body = await req.json().catch(() => null);
    const parsed = estimateDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid decision payload.", parsed.error.flatten());
    }

    const nextStatus =
      parsed.data.decision === "APPROVED" ? EstimateStatus.APPROVED : EstimateStatus.DECLINED;

    const [decision, updatedEstimate] = await prisma.$transaction([
      prisma.estimateDecision.create({
        data: {
          estimateId: id,
          decision: parsed.data.decision as EstimateDecisionType,
          decidedByAccountId: account.id,
          note: parsed.data.note,
        },
      }),
      prisma.estimate.update({ where: { id }, data: { status: nextStatus } }),
    ]);

    await writeAuditLog({
      actorId: account.id,
      action: "estimate.decision",
      entityType: "Estimate",
      entityId: id,
      metadata: { decision: parsed.data.decision },
    });

    return apiOk({ decision, estimate: updatedEstimate }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
