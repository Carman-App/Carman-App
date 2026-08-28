import { NextResponse } from "next/server";

/** Consistent JSON error shape for every /api/v1/* route. */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, details } },
    { status },
  );
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Consistent envelope for every paginated /api/v1/* list endpoint. */
export function apiOkPaginated<T>(
  items: T[],
  pagination: { page: number; pageSize: number; total: number },
) {
  const meta: PaginationMeta = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    totalPages: Math.max(1, Math.ceil(pagination.total / pagination.pageSize)),
  };
  return NextResponse.json({ data: items, pagination: meta }, { status: 200 });
}
