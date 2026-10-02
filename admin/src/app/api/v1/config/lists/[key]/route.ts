import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// GET /api/v1/config/lists/:key — the active items of a single named
// ConfigList (e.g. "record_categories", "document_types"), for reference-data
// screens in mobile to consume with a hardcoded fallback (see
// mobile/src/app/doc/scan.tsx). `isActive: true` on ConfigListItem is the
// live truth for this config shape (CFG-03 uses direct-edit, not
// draft/publish/ConfigVersion, unlike Country) — no version join needed.
//
// Not paginated: these lists are small by design (a handful of items each,
// authored by hand in the admin console), unlike the ~50+ row collections
// (garages, records, ...) that use parsePagination elsewhere in this API.
//
// No role/permission check beyond identity (per the brief): any signed-in
// account can read this.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    await requireAccount(req);
    const { key } = await params;

    const list = await prisma.configList.findUnique({ where: { key } });
    if (!list) {
      throw new NotFoundError(`No config list with key "${key}".`);
    }

    const items = await prisma.configListItem.findMany({
      where: { listId: list.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return apiOk(items);
  } catch (error) {
    return handleApiError(error);
  }
}
