import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, AUDIT_LOG_ROLES } from "@/lib/auth/rbac";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/badge";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = {
  actorId?: string;
  targetAccountId?: string;
  action?: string;
  from?: string;
  to?: string;
};

function buildWhere(sp: SearchParams): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.actorId) where.actorId = sp.actorId;
  if (sp.targetAccountId) where.targetAccountId = sp.targetAccountId;
  if (sp.action) where.action = { contains: sp.action, mode: "insensitive" };
  if (sp.from || sp.to) {
    where.createdAt = {
      ...(sp.from ? { gte: new Date(sp.from) } : {}),
      ...(sp.to ? { lte: new Date(sp.to + "T23:59:59.999Z") } : {}),
    };
  }
  return where;
}

async function getEntries(sp: SearchParams) {
  return prisma.auditLog.findMany({
    where: buildWhere(sp),
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(AUDIT_LOG_ROLES);
  const sp = await searchParams;
  const entries = await getEntries(sp);

  const exportQs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => Boolean(v)) as [string, string][],
  ).toString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Audit log</h1>
        <p className="text-sm text-neutral-500">
          Every admin write, append-only (AUD-01) — actor, action, target, before/after, reason,
          IP, timestamp. Not editable by anyone, including Owner; enforced both in code (no
          update/delete function exists) and by a database trigger.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded border border-neutral-200 p-4">
        <div>
          <label className="block text-xs text-neutral-500">Actor (admin) id</label>
          <input
            name="actorId"
            defaultValue={sp.actorId}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Target account id</label>
          <input
            name="targetAccountId"
            defaultValue={sp.targetAccountId}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Action contains</label>
          <input
            name="action"
            defaultValue={sp.action}
            placeholder="e.g. account.suspend"
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
        >
          Filter
        </button>
        <Link
          href={`/api/admin/audit/export${exportQs ? `?${exportQs}` : ""}`}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
        >
          Export CSV
        </Link>
      </form>

      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">When</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Actor</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Action</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Entity</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Target account</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Reason</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  No matching audit entries.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-neutral-100">
                <td className="whitespace-nowrap px-4 py-2">{formatDateTime(e.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <Badge value={e.actorType} /> {e.actorId ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {e.entityType} / {e.entityId}
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {e.targetAccountId ? (
                    <Link href={`/accounts/${e.targetAccountId}`} className="hover:underline">
                      {e.targetAccountId}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-2" title={e.reason ?? undefined}>
                  {e.reason ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2">{e.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
