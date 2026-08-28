import Link from "next/link";
import type { ReactNode } from "react";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  href,
  emptyLabel = "Nothing here yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  /** Build the detail-page href for a row. Omit to render a non-linked table. */
  href?: (row: T) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-neutral-200">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-neutral-50 text-neutral-600">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="whitespace-nowrap px-4 py-2 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {rows.map((row) => (
            <tr key={row.id} className="transition hover:bg-neutral-100">
              {columns.map((col) => (
                <td key={col.header} className={`whitespace-nowrap px-0 py-0 ${col.className ?? ""}`}>
                  {href ? (
                    <Link href={href(row)} className="block px-4 py-2 hover:text-neutral-900">
                      {col.cell(row)}
                    </Link>
                  ) : (
                    <span className="block px-4 py-2">{col.cell(row)}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
