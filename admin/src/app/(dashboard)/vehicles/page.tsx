import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getVehicles() {
  return prisma.vehicle.findMany({
    include: { garage: { include: { owner: { include: { user: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export default async function VehiclesPage() {
  await requireRole(ACCOUNTS_ROLES);
  const vehicles = await getVehicles();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Vehicles</h1>
        <p className="text-sm text-neutral-500">Every vehicle across every garage.</p>
      </div>
      <DataTable
        rows={vehicles}
        href={(row) => `/vehicles/${row.id}`}
        emptyLabel="No vehicles yet."
        columns={[
          { header: "Vehicle", cell: (row) => `${row.year} ${row.make} ${row.model}` },
          { header: "Plate", cell: (row) => row.plate },
          { header: "Type", cell: (row) => <Badge value={row.type} /> },
          { header: "Usage", cell: (row) => <Badge value={row.usage} /> },
          { header: "Odometer", cell: (row) => `${row.odometerKm.toLocaleString()} km` },
          { header: "Garage", cell: (row) => row.garage.name },
          { header: "Owner", cell: (row) => row.garage.owner.user.name },
        ]}
      />
    </div>
  );
}
