import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { formatDate } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getGarages() {
  return prisma.garage.findMany({
    include: { owner: { include: { user: true } }, _count: { select: { members: true, vehicles: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export default async function GaragesPage() {
  await requireRole(ACCOUNTS_ROLES);
  const garages = await getGarages();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Garages</h1>
        <p className="text-sm text-neutral-500">Every garage, its owner, and its size.</p>
      </div>
      <DataTable
        rows={garages}
        href={(row) => `/garages/${row.id}`}
        emptyLabel="No garages yet."
        columns={[
          { header: "Name", cell: (row) => row.name },
          { header: "Location", cell: (row) => row.location },
          { header: "Owner", cell: (row) => row.owner.user.name },
          { header: "Members", cell: (row) => row._count.members },
          { header: "Vehicles", cell: (row) => row._count.vehicles },
          { header: "Created", cell: (row) => formatDate(row.createdAt) },
        ]}
      />
    </div>
  );
}
