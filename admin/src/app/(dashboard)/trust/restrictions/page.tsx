import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES, TRUST_DANGEROUS_ROLES } from "@/lib/auth/rbac";
import { CreateRestrictionForm } from "./create-form";
import { LiftForm } from "./lift-form";

export const dynamic = "force-dynamic";

export default async function RestrictionsPage() {
  const session = await requireRole(TRUST_ROLES);
  const canManage = TRUST_DANGEROUS_ROLES.includes(session.role);

  const restrictions = await prisma.capabilityRestriction.findMany({
    include: { account: { include: { user: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const now = new Date().getTime();
  const isActive = (r: (typeof restrictions)[number]) => !r.liftedAt && r.endAt.getTime() > now;

  const adminIds = [
    ...new Set([
      ...restrictions.map((r) => r.createdByAdminId),
      ...restrictions.map((r) => r.liftedByAdminId).filter((v): v is string => Boolean(v)),
    ]),
  ];
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trust" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Reports & disputes
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Capability restrictions</h1>
        <p className="text-sm text-neutral-500">
          Restrict one capability instead of suspending the whole account. Active status is computed
          live (endAt in the future and not lifted early) — nothing here relies on a scheduled job.
        </p>
      </div>

      {canManage && (
        <Section title="Apply a new restriction">
          <CreateRestrictionForm />
        </Section>
      )}

      <Section title="All restrictions">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Account</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Capability</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Reason</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Starts</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Ends</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Created by</th>
                {canManage && <th className="whitespace-nowrap px-4 py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {restrictions.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="px-4 py-6 text-center text-neutral-500">
                    No restrictions applied yet.
                  </td>
                </tr>
              )}
              {restrictions.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link href={`/accounts/${r.accountId}`} className="hover:underline">
                      {r.account.user.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge value={r.capability} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {r.liftedAt ? (
                      <span className="text-neutral-500">Lifted {formatDateTime(r.liftedAt)}</span>
                    ) : isActive(r) ? (
                      <span className="text-amber-700">Active</span>
                    ) : (
                      <span className="text-neutral-500">Expired</span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2" title={r.reason}>
                    {r.reason}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{formatDateTime(r.startAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2">{formatDateTime(r.endAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2">{adminNames.get(r.createdByAdminId) ?? r.createdByAdminId}</td>
                  {canManage && (
                    <td className="px-4 py-2">{isActive(r) && <LiftForm restrictionId={r.id} />}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
