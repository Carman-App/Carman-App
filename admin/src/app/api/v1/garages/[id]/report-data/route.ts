import type { NextRequest } from "next/server";
import { requireAccount } from "@/lib/api/auth";
import { requireGarageMembership } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { getGarageReportData } from "@/lib/reports/report-data";

// GET /api/v1/garages/:id/report-data — the whole garage as one snapshot for
// the web expense report (web/): members (former ones included, so old
// records keep their attribution), every vehicle, every live record of all
// five types with entry/edit stamps, soft-deleted records (counted, never
// totalled), open reminders, documents, project builds, the service
// intervals config list, and the caller's currency/unit conventions.
// Read-only and unpaginated by design — see src/lib/reports/report-data.ts.
// Chain: auth -> account -> membership -> snapshot.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: garageId } = await params;

    await requireGarageMembership(account.id, garageId);

    return apiOk(await getGarageReportData(garageId, account));
  } catch (error) {
    return handleApiError(error);
  }
}
