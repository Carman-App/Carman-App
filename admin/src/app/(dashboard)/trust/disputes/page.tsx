import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { DisputeStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

async function getDisputes() {
  return prisma.dispute.findMany({
    include: {
      job: { include: { workshop: true } },
      vehicle: true,
      workshop: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export default async function DisputesPage() {
  await requireRole(TRUST_ROLES);
  const disputes = await getDisputes();
  const openCount = disputes.filter((d) => d.status === DisputeStatus.OPEN).length;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/trust" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Reports & disputes
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Disputes</h1>
        <p className="text-sm text-neutral-500">{openCount} open.</p>
      </div>

      <DataTable
        rows={disputes}
        href={(row) => `/trust/disputes/${row.id}`}
        emptyLabel="No disputes raised yet."
        columns={[
          { header: "Kind", cell: (r) => <Badge value={r.kind} /> },
          { header: "Status", cell: (r) => <Badge value={r.status} /> },
          { header: "Reason", cell: (r) => r.reason },
          { header: "Workshop", cell: (r) => r.workshop?.name ?? r.job?.workshop.name ?? "—" },
          { header: "Vehicle", cell: (r) => (r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : "—") },
          { header: "Raised", cell: (r) => formatDateTime(r.createdAt) },
        ]}
      />
    </div>
  );
}
