import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole, PRIVACY_ROLES } from "@/lib/auth/rbac";
import { PrivacyNav } from "../privacy-nav";
import { RetentionRuleForm } from "./rule-form";

export const dynamic = "force-dynamic";

// PRIV-04 — retention windows. RetentionRule is real config; RetentionPurgeLog
// is a real table that will only ever be written to once a real purge runs.
// No scheduler exists anywhere in this codebase (same job-queue prerequisite
// the System surface's OPS-02/03 name for background jobs generally), so
// "next scheduled purge" below is a *computed*, not an *actually scheduled*,
// date — nothing executes it.
export default async function RetentionPage() {
  await requireRole(PRIVACY_ROLES);

  const [rules, purgeLogs] = await Promise.all([
    prisma.retentionRule.findMany({
      orderBy: { dataClass: "asc" },
      include: { purgeLogs: { orderBy: { ranAt: "desc" }, take: 1 } },
    }),
    prisma.retentionPurgeLog.findMany({
      orderBy: { ranAt: "desc" },
      take: 100,
      include: { rule: { select: { dataClass: true } } },
    }),
  ]);

  const adminIds = [...new Set(rules.map((r) => r.updatedByAdminId).filter((id): id is string => Boolean(id)))];
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, email: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, `${a.name} (${a.email})`]));

  function nextScheduledPurge(rule: (typeof rules)[number]): Date {
    const basis = rule.purgeLogs[0]?.ranAt ?? rule.updatedAt;
    return new Date(basis.getTime() + rule.retentionDays * 24 * 60 * 60 * 1000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Retention windows</h1>
        <p className="text-sm text-neutral-500">
          Configuration for how long each class of data should be kept. There is no{" "}
          <code>nextDueAt</code> column — &ldquo;next scheduled purge&rdquo; below is computed
          in-app from each rule&rsquo;s last update (or its most recent purge log entry) plus its
          retention window, not a stored fact.
        </p>
      </div>

      <PrivacyNav active="/privacy/retention" />

      <Section title="Execution status — a real, honest gap">
        <div className="rounded border border-dashed border-neutral-200 p-4 text-sm text-neutral-600">
          <p>
            Nothing in this codebase actually runs a purge on schedule. That needs the same
            prerequisite the System surface&rsquo;s OPS-02/03 (background job visibility &amp;
            retry) name as missing: a real job queue (e.g. BullMQ + Redis, or a Postgres-backed
            queue like graphile-worker/pg-boss) plus one or more worker processes. Until that
            exists, the &ldquo;next scheduled purge&rdquo; dates below are a computed projection of
            what the configured window implies — not a promise anything will happen on that date.
          </p>
          <p className="mt-2">
            <code>RetentionPurgeLog.performedByAdminId</code> is null on every row a real scheduled
            run would create; it&rsquo;s also where a one-off manual purge, if anyone ever ran one
            by hand, would log what it removed. No such log exists today (see below).
          </p>
        </div>
      </Section>

      <Section title="Rules">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Data class</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Retention</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Description</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Next scheduled purge (computed)</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    No retention rules configured yet — add one below.
                  </td>
                </tr>
              )}
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{r.dataClass}</td>
                  <td className="whitespace-nowrap px-4 py-2">{r.retentionDays} days</td>
                  <td className="max-w-xs truncate px-4 py-2" title={r.description ?? undefined}>
                    {r.description ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{formatDate(nextScheduledPurge(r))}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatDateTime(r.updatedAt)}
                    {r.updatedByAdminId && <> — {adminNames.get(r.updatedByAdminId) ?? r.updatedByAdminId}</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Add / edit a rule">
        <RetentionRuleForm />
      </Section>

      <Section title="Purge log (RetentionPurgeLog) — empty; no scheduler runs">
        <DataTable
          rows={purgeLogs}
          emptyLabel="No purges have ever run — expected, since no scheduler exists yet."
          columns={[
            { header: "Data class", cell: (r) => r.rule.dataClass },
            { header: "Ran at", cell: (r) => formatDateTime(r.ranAt) },
            { header: "Records removed", cell: (r) => r.recordsRemoved },
            {
              header: "Performed by",
              cell: (r) => (r.performedByAdminId ? (adminNames.get(r.performedByAdminId) ?? r.performedByAdminId) : "System (scheduled)"),
            },
            { header: "Notes", cell: (r) => r.notes ?? "—" },
          ]}
        />
      </Section>
    </div>
  );
}
