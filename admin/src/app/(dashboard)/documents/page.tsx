import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { formatDate } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getDocuments() {
  return prisma.document.findMany({
    where: { deletedAt: null },
    include: { documentType: true, vehicle: true },
    orderBy: { addedAt: "desc" },
    take: 200,
  });
}

export default async function DocumentsPage() {
  await requireRole(ACCOUNTS_ROLES);
  const documents = await getDocuments();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Documents</h1>
        <p className="text-sm text-neutral-500">
          Insurance, logbooks, inspection reports, invoices, and receipts across every vehicle. Open
          a row to take one down (TRUST-05) without destroying its record.
        </p>
      </div>
      <DataTable
        rows={documents}
        href={(row) => `/trust/takedowns/${row.id}`}
        emptyLabel="No documents uploaded yet."
        columns={[
          { header: "Title", cell: (row) => (row.takedownAt ? "[Image removed]" : row.title) },
          { header: "Type", cell: (row) => row.documentType.label },
          { header: "Vehicle", cell: (row) => `${row.vehicle.year} ${row.vehicle.make} ${row.vehicle.model}` },
          { header: "Status", cell: (row) => (row.takedownAt ? "Taken down" : "Active") },
          { header: "Expires", cell: (row) => formatDate(row.expiryDate) },
          { header: "Added", cell: (row) => formatDate(row.addedAt) },
        ]}
      />
    </div>
  );
}
