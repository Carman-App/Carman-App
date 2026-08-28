import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, DATA_QUALITY_ROLES } from "@/lib/auth/rbac";
import { formatDateTime } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// DATA-06 — sync errors. Nothing populates SyncError today: there is no
// client-side error-reporting pipeline in the mobile app yet, so this list
// is expected to render empty until a future mobile change starts POSTing
// failures here. This page states that plainly rather than only in a code
// comment, and never fabricates a row.

type SearchParams = {
  accountId?: string;
  operation?: string;
  from?: string;
  to?: string;
};

function buildWhere(sp: SearchParams): Prisma.SyncErrorWhereInput {
  const where: Prisma.SyncErrorWhereInput = {};
  if (sp.accountId) where.accountId = sp.accountId;
  if (sp.operation) where.operation = { contains: sp.operation, mode: "insensitive" };
  if (sp.from || sp.to) {
    where.occurredAt = {
      ...(sp.from ? { gte: new Date(sp.from) } : {}),
      ...(sp.to ? { lte: new Date(sp.to + "T23:59:59.999Z") } : {}),
    };
  }
  return where;
}

async function getSyncErrors(sp: SearchParams) {
  return prisma.syncError.findMany({
    where: buildWhere(sp),
    include: { account: { include: { user: true } } },
    orderBy: { occurredAt: "desc" },
    take: 300,
  });
}

export default async function SyncErrorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(DATA_QUALITY_ROLES);
  const sp = await searchParams;
  const errors = await getSyncErrors(sp);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/data-quality" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Records & data quality
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Sync errors</h1>
        <p className="text-sm text-neutral-500">
          A client-reported sync/upload failure log (account, device, operation, message, when it
          happened, when it was resolved).
        </p>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800/80">
        <strong className="text-amber-800">This will always be empty today.</strong> The mobile app
        has no client-side error-reporting pipeline yet — nothing POSTs into this table. This page
        is built and ready to show real data the moment that instrumentation ships; building that
        mobile-side reporting is out of scope for this pass.
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded border border-neutral-200 p-4">
        <div>
          <label className="block text-xs text-neutral-500">Account id</label>
          <input
            name="accountId"
            defaultValue={sp.accountId}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Operation contains</label>
          <input
            name="operation"
            defaultValue={sp.operation}
            placeholder="e.g. record.create"
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Occurred from</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Occurred to</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Occurred</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Account</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Operation</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Message</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Resolved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {errors.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  No sync errors reported — see note above.
                </td>
              </tr>
            )}
            {errors.map((e) => (
              <tr key={e.id} className="transition hover:bg-neutral-100">
                <td className="whitespace-nowrap px-0 py-0">
                  <Link href={`/data-quality/sync-errors/${e.id}`} className="block px-4 py-2 hover:text-neutral-900">
                    {formatDateTime(e.occurredAt)}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2">{e.account?.user.name ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{e.operation}</td>
                <td className="max-w-sm truncate px-4 py-2" title={e.message}>
                  {e.message}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{e.resolvedAt ? formatDateTime(e.resolvedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
