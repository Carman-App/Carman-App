import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { getRecordsFeed, getRecordsCount } from "@/lib/records";

type TimelineItem =
  | ({ kind: "FUEL" | "SERVICE" | "REPAIR" | "EXPENSE" | "ODOMETER" } & Awaited<
      ReturnType<typeof getRecordsFeed>
    >[number])
  | {
      id: string;
      kind: "DOCUMENT";
      date: Date;
      vehicleId: string;
      amount: null;
      description: string;
      enteredByName: string | null;
    };

// GET /api/v1/vehicles/:id/timeline — merged, reverse-chronological view
// across all five record types plus documents. Paginated the same way as
// vehicles/:id/records (over-fetch enough to cover the page, sort, slice —
// heterogeneous sources can't be paginated at the DB level).
// Chain: auth -> account -> membership/ownership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const limit = skip + take;

    const [records, documents, recordsTotal, documentsTotal] = await Promise.all([
      getRecordsFeed({ vehicleId, take: limit }),
      prisma.document.findMany({
        where: { vehicleId, deletedAt: null },
        include: { documentType: true },
        orderBy: { addedAt: "desc" },
        take: limit,
      }),
      getRecordsCount(vehicleId),
      prisma.document.count({ where: { vehicleId, deletedAt: null } }),
    ]);

    const documentItems: TimelineItem[] = documents.map((d) => ({
      id: d.id,
      kind: "DOCUMENT",
      date: d.addedAt,
      vehicleId: d.vehicleId,
      amount: null,
      description: `${d.documentType.label} — ${d.title}`,
      enteredByName: d.uploadedByAccountId,
    }));

    const merged: TimelineItem[] = [...records, ...documentItems];
    merged.sort((a, b) => b.date.getTime() - a.date.getTime());

    return apiOkPaginated(merged.slice(skip, skip + take), {
      page,
      pageSize,
      total: recordsTotal + documentsTotal,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
