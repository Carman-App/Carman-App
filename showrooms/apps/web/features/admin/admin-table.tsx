"use client";

import { ErrorState, EmptyState, Pagination, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api-error";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

/** Desktop-first data table that collapses to cards on small screens. */
export function AdminTable<T extends { id: string }>({ columns, rows, loading, error, onRetry, page, totalPages, onPage, empty = "Nothing to show", onRowClick }: {
  columns: Column<T>[];
  rows?: T[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  page?: number;
  totalPages?: number;
  onPage?: (p: number) => void;
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <Skeleton className="h-80 w-full" />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={onRetry} />;
  if (!rows?.length) return <EmptyState title={empty} />;
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-white shadow-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs tracking-wide text-ink-muted uppercase">
            <tr>{columns.map((c) => <th key={c.key} scope="col" className={`p-3 font-semibold ${c.className ?? ""}`}>{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className={onRowClick ? "cursor-pointer hover:bg-surface" : undefined} onClick={() => onRowClick?.(r)}>
                {columns.map((c) => <td key={c.key} className={`p-3 align-top ${c.className ?? ""}`}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-white p-3 text-sm shadow-card" onClick={() => onRowClick?.(r)}>
            {columns.map((c) => (
              <div key={c.key} className="flex justify-between gap-3 py-0.5"><span className="text-ink-muted">{c.header}</span><span className="text-right">{c.cell(r)}</span></div>
            ))}
          </li>
        ))}
      </ul>
      {page && totalPages ? <Pagination page={page} totalPages={totalPages} onPage={onPage} /> : null}
    </>
  );
}
