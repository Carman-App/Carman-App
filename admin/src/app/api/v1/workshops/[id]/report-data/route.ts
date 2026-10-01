import type { NextRequest } from "next/server";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { getWorkshopReportData } from "@/lib/reports/report-data";

// GET /api/v1/workshops/:id/report-data — the workshop as one snapshot for
// the web work report (web/): staff, customers, every job with its lines,
// assignments and status history, estimates with decisions, and invoices
// with their payments. There is no other route that lists a workshop's
// invoices or payments. Read-only and unpaginated by design — see
// src/lib/reports/report-data.ts.
// Chain: auth -> account -> membership -> snapshot.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: workshopId } = await params;

    await requireWorkshopMembership(account.id, workshopId);

    return apiOk(await getWorkshopReportData(workshopId, account));
  } catch (error) {
    return handleApiError(error);
  }
}
