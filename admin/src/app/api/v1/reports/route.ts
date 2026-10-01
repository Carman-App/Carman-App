import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership, requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { createReportSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { ReportFormat, ReportScope } from "@/generated/prisma/enums";

// POST /api/v1/reports — generate a report scoped to a vehicle or a garage
// for a period. Actual PDF/file generation is out of scope for this pass
// (see src/lib/storage.ts) — this creates the Report + ReportRecipient rows
// that a background job or a later phase would render and deliver;
// fileKey stays null until that exists.
// Chain: auth -> account -> vehicle/garage membership (per scope) -> validate -> create -> audit log.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const body = await req.json().catch(() => null);
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid report payload.", parsed.error.flatten());
    }
    const input = parsed.data;

    if (input.scope === ReportScope.VEHICLE) {
      await requireVehicleAccess(account.id, input.scopeId);
    } else {
      await requireGarageMembership(account.id, input.scopeId);
    }

    const report = await prisma.report.create({
      data: {
        scope: input.scope as ReportScope,
        scopeId: input.scopeId,
        periodLabel: input.periodLabel,
        format: input.format as ReportFormat | undefined,
        generatedByAccountId: account.id,
        recipients: input.recipients
          ? { create: input.recipients.map((r) => ({ email: r.email, name: r.name })) }
          : undefined,
      },
      include: { recipients: true },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "report.generate",
      entityType: "Report",
      entityId: report.id,
      metadata: { scope: input.scope, scopeId: input.scopeId },
    });

    return apiOk(report, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
