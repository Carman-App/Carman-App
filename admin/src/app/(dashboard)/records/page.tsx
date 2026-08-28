import { getRecordsFeed } from "@/lib/records";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  await requireRole(ACCOUNTS_ROLES);
  const records = await getRecordsFeed({ take: 200 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Records</h1>
        <p className="text-sm text-neutral-500">
          Fuel, service, repair, expense, and odometer entries across every vehicle, newest first.
        </p>
      </div>
      <DataTable
        rows={records}
        href={(row) => `/vehicles/${row.vehicleId}`}
        emptyLabel="No records yet."
        columns={[
          { header: "Date", cell: (r) => formatDate(r.date) },
          { header: "Type", cell: (r) => <Badge value={r.kind} /> },
          { header: "Description", cell: (r) => r.description },
          { header: "Amount", cell: (r) => (r.amount ? formatMoney(r.amount) : "—") },
          { header: "Entered by", cell: (r) => r.enteredByName },
        ]}
      />
    </div>
  );
}
