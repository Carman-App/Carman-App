import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { formatDate } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getWorkshops() {
  return prisma.workshop.findMany({
    include: {
      owner: { include: { user: true } },
      _count: { select: { members: true, jobs: true, customers: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export default async function WorkshopsPage() {
  await requireRole(ACCOUNTS_ROLES);
  const workshops = await getWorkshops();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Workshops</h1>
        <p className="text-sm text-neutral-500">Every workshop, its owner, staff, and customer book size.</p>
      </div>
      <DataTable
        rows={workshops}
        href={(row) => `/workshops/${row.id}`}
        emptyLabel="No workshops yet."
        columns={[
          { header: "Name", cell: (row) => row.name },
          { header: "Owner", cell: (row) => row.owner.user.name },
          { header: "Staff", cell: (row) => row._count.members },
          { header: "Customers", cell: (row) => row._count.customers },
          { header: "Jobs", cell: (row) => row._count.jobs },
          { header: "Created", cell: (row) => formatDate(row.createdAt) },
        ]}
      />
    </div>
  );
}
