import type { NextRequest } from "next/server";

/**
 * Shared offset pagination for every /api/v1/* list endpoint that could
 * return more than ~50 rows (records, timeline, notifications, jobs, ...).
 * Query params: ?page=1&pageSize=25 (1-based page, capped pageSize).
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PaginationParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export function parsePagination(req: NextRequest): PaginationParams {
  const searchParams = req.nextUrl.searchParams;

  const rawPage = Number(searchParams.get("page"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawPageSize = Number(searchParams.get("pageSize"));
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(MAX_PAGE_SIZE, Math.floor(rawPageSize))
      : DEFAULT_PAGE_SIZE;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
