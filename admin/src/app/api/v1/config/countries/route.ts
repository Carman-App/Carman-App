import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";

// GET /api/v1/config/countries — the published (live) Country rows for
// mobile's onboarding country picker to consume, with mobile's own
// hardcoded ~66-country list as the fallback when this is empty or errors
// (see mobile/src/app/onboarding/country.tsx). Publishing a Country draft
// upserts the live `Country` row directly (see
// admin/src/lib/config/versioning.ts's applyPayloadToLive), so `isLive: true`
// on this table IS the "published" filter — no ConfigVersion join needed.
//
// No role/permission check beyond identity (per the brief): any signed-in
// account can read this, same as e.g. garages/route.ts. Paginated like every
// other /api/v1/* list endpoint (AGENTS.md scalability pass, section 4) —
// today's live table is likely empty or tiny (nothing authored yet in a
// fresh DB), but more countries could be published over time.
export async function GET(req: NextRequest) {
  try {
    await requireAccount(req);
    const { page, pageSize, skip, take } = parsePagination(req);

    const where = { isLive: true };
    const [countries, total] = await Promise.all([
      prisma.country.findMany({ where, orderBy: { name: "asc" }, skip, take }),
      prisma.country.count({ where }),
    ]);

    return apiOkPaginated(countries, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}
