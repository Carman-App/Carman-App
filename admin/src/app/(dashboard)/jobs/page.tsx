import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getJobs() {
  return prisma.job.findMany({
    include: { workshop: true, customer: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export default async function JobsPage() {
  await requireRole(ACCOUNTS_ROLES);
  const jobs = await getJobs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Jobs</h1>
        <p className="text-sm text-neutral-500">Every job across every workshop, by current state.</p>
      </div>
      <DataTable
        rows={jobs}
        href={(row) => `/jobs/${row.id}`}
        emptyLabel="No jobs yet."
        columns={[
          { header: "Customer", cell: (row) => row.customer.name },
          { header: "Fault", cell: (row) => row.faultDescription },
          { header: "Workshop", cell: (row) => row.workshop.name },
          { header: "Status", cell: (row) => <Badge value={row.status} /> },
          { header: "Opened", cell: (row) => formatDate(row.createdAt) },
        ]}
      />
    </div>
  );
}
