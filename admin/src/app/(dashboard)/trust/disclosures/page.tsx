import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES, TRUST_DANGEROUS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function DisclosuresPage() {
  const session = await requireRole(TRUST_ROLES);
  const canCreate = TRUST_DANGEROUS_ROLES.includes(session.role);

  const requests = await prisma.disclosureRequest.findMany({
    orderBy: { receivedAt: "desc" },
    take: 200,
  });

  const approverIds = [...new Set(requests.map((r) => r.approvedByAdminId))];
  const approvers = approverIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true } })
    : [];
  const approverNames = new Map(approvers.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/trust" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Reports & disputes
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-neutral-900">Disclosure requests</h1>
          <p className="text-sm text-neutral-500">Police, insurer, and regulator requests — one compliance record per request.</p>
        </div>
        {canCreate && (
          <Link
            href="/trust/disclosures/new"
            className="whitespace-nowrap rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700"
          >
            Record a request
          </Link>
        )}
      </div>

      <DataTable
        rows={requests}
        href={(row) => `/trust/disclosures/${row.id}`}
        emptyLabel="No disclosure requests recorded yet."
        columns={[
          { header: "Type", cell: (r) => <Badge value={r.requestType} /> },
          { header: "Requester", cell: (r) => `${r.requesterName} (${r.requesterOrg})` },
          { header: "Legal authority", cell: (r) => r.legalAuthority },
          { header: "Related account", cell: (r) => (r.relatedAccountId ? <Link href={`/accounts/${r.relatedAccountId}`} className="hover:underline">{r.relatedAccountId}</Link> : "—") },
          { header: "Approved by", cell: (r) => approverNames.get(r.approvedByAdminId) ?? r.approvedByAdminId },
          { header: "User notified", cell: (r) => (r.userNotified ? `Yes (${formatDate(r.userNotifiedAt)})` : "No") },
          { header: "Received", cell: (r) => formatDateTime(r.receivedAt) },
        ]}
      />
    </div>
  );
}
