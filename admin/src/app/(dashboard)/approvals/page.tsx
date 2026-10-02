import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/auth/rbac";
import { DANGEROUS_ACTIONS } from "@/lib/dangerous-actions";
import { AdminRole, ApprovalStatus } from "@/generated/prisma/enums";
import { ApprovalRowActions } from "./row-actions";

export const dynamic = "force-dynamic";

/** Where the requests that are decided on their own page live. */
const OWN_PAGE: Record<string, (entityId: string) => string> = {
  "garage.transfer_owner": (id) => `/garages/${id}`,
  "billing.refund": () => "/billing/refunds",
};

/**
 * AUD-03 — every request waiting on a second admin, in one place. Nobody
 * approves their own request; the approver must hold the role the action
 * itself needs. Decided requests stay listed below as the record.
 */
export default async function ApprovalsPage() {
  const session = await requireRole([AdminRole.OWNER, AdminRole.FINANCE]);

  const [pending, decided] = await Promise.all([
    prisma.twoPersonApproval.findMany({ where: { status: ApprovalStatus.PENDING }, orderBy: { requestedAt: "asc" } }),
    prisma.twoPersonApproval.findMany({ where: { status: { not: ApprovalStatus.PENDING } }, orderBy: { requestedAt: "desc" }, take: 30 }),
  ]);

  const adminIds = [...new Set([...pending, ...decided].flatMap((a) => [a.requestedByAdminId, a.approvedByAdminId]).filter((x): x is string => !!x))];
  const admins = adminIds.length ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(admins.map((a) => [a.id, a.name]));

  const pendingRows = await Promise.all(
    pending.map(async (a) => {
      const def = DANGEROUS_ACTIONS[a.action];
      const payload = a.payload as Record<string, unknown>;
      return {
        a,
        def,
        label: def?.label ?? a.action,
        description: def ? await def.describe(payload) : null,
        href: def ? def.href(payload) : (OWN_PAGE[a.action]?.(a.entityId) ?? null),
        canDecide: !!def && def.roles.includes(session.role),
      };
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Approvals</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Deleting an account, exporting someone&rsquo;s data, publishing config, changing an admin&rsquo;s role, handing
          over a garage and large refunds each need a second admin. Nobody approves their own request.
        </p>
      </div>

      <Section title={`Waiting · ${pending.length}`}>
        {pendingRows.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing is waiting on a second admin.</p>
        ) : (
          <div className="divide-y divide-neutral-200 border-y border-neutral-200">
            {pendingRows.map(({ a, label, description, href, canDecide, def }) => (
              <div key={a.id} className="grid gap-3 py-4 md:grid-cols-[1fr_280px]">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-neutral-900">{label}</p>
                  {description && <p className="text-sm text-neutral-700">{description}</p>}
                  <p className="text-xs text-neutral-500">
                    Requested by {nameOf.get(a.requestedByAdminId) ?? "unknown"} · {formatDateTime(a.requestedAt)}
                  </p>
                  <p className="text-xs text-neutral-600">Reason: {a.reason}</p>
                  {href && (
                    <Link href={href} className="text-xs text-carma-600 hover:underline">
                      Open
                    </Link>
                  )}
                </div>
                <div>
                  {!def ? (
                    <p className="text-xs text-neutral-500">Decided from its own page.</p>
                  ) : canDecide ? (
                    <ApprovalRowActions approvalId={a.id} ownRequest={a.requestedByAdminId === session.adminId} />
                  ) : (
                    <p className="text-xs text-neutral-500">Needs an admin with the {def.roles.join(" or ")} role.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recently decided">
        {decided.length === 0 ? (
          <p className="text-sm text-neutral-500">No decisions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-4 py-2 font-medium">Request</th>
                  <th className="px-4 py-2 font-medium">Requested by</th>
                  <th className="px-4 py-2 font-medium">Decided by</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {decided.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 text-neutral-900">
                      {DANGEROUS_ACTIONS[a.action]?.label ?? a.action}
                      {a.executionError && <span className="block text-xs text-red-600">Failed: {a.executionError}</span>}
                      {a.rejectedReason && <span className="block text-xs text-neutral-500">Rejected: {a.rejectedReason}</span>}
                    </td>
                    <td className="px-4 py-2 text-neutral-700">{nameOf.get(a.requestedByAdminId) ?? "unknown"}</td>
                    <td className="px-4 py-2 text-neutral-700">{a.approvedByAdminId ? (nameOf.get(a.approvedByAdminId) ?? "unknown") : "—"}</td>
                    <td className="px-4 py-2">
                      <Badge value={a.status} />
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{formatDateTime(a.approvedAt ?? a.requestedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
