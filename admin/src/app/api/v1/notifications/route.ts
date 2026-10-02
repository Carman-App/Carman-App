import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { withApiLogging } from "@/lib/api/withLogging";

// GET /api/v1/notifications — the caller's own notification feed, paginated.
// ?unread=true to only return unread notifications.
// Chain: auth -> account -> query. Wrapped with structured request
// logging — exercised by the load test (section 21).
export const GET = withApiLogging("notifications.list", async (req: NextRequest) => {
  try {
    const account = await requireAccount(req);

    const { page, pageSize, skip, take } = parsePagination(req);
    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
    const where = unreadOnly
      ? { accountId: account.id, readAt: null }
      : { accountId: account.id };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.notification.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
});
