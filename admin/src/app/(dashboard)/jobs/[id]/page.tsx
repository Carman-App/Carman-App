import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getJob(id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: {
      workshop: true,
      customer: true,
      vehicle: true,
      lines: true,
      assignments: { include: { workshopMember: { include: { account: { include: { user: true } } } } } },
      estimates: { include: { items: true } },
      invoices: { include: { items: true, payments: true } },
    },
  });
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ACCOUNTS_ROLES);
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="text-sm text-neutral-500 hover:text-neutral-200">
          ← Jobs
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-100">{job.faultDescription}</h1>
      </div>

      <DetailView
        title="Job"
        fields={[
          { label: "Status", value: <Badge value={job.status} /> },
          {
            label: "Workshop",
            value: (
              <Link href={`/workshops/${job.workshopId}`} className="hover:underline">
                {job.workshop.name}
              </Link>
            ),
          },
          { label: "Customer", value: job.customer.name },
          {
            label: "Vehicle",
            value: job.vehicle ? (
              <Link href={`/vehicles/${job.vehicleId}`} className="hover:underline">
                {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
              </Link>
            ) : (
              job.vehicleDescription ?? "Not on Carma"
            ),
          },
          { label: "Opened", value: formatDateTime(job.createdAt) },
          { label: "Updated", value: formatDateTime(job.updatedAt) },
        ]}
      />

      <Section title="Job lines">
        <DataTable
          rows={job.lines}
          emptyLabel="No lines yet."
          columns={[
            { header: "Kind", cell: (r) => <Badge value={r.kind} /> },
            { header: "Description", cell: (r) => r.description },
            { header: "Cost", cell: (r) => formatMoney(r.cost) },
          ]}
        />
      </Section>

      <Section title="Assigned staff">
        <DataTable
          rows={job.assignments}
          emptyLabel="Unassigned."
          columns={[
            { header: "Name", cell: (r) => r.workshopMember.displayName || r.workshopMember.account.user.name },
            { header: "Assigned", cell: (r) => formatDate(r.assignedAt) },
          ]}
        />
      </Section>

      <Section title="Estimates">
        <DataTable
          rows={job.estimates}
          emptyLabel="No estimates yet."
          columns={[
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Total", cell: (r) => formatMoney(r.total) },
            { header: "Lines", cell: (r) => r.items.length },
            { header: "Created", cell: (r) => formatDate(r.createdAt) },
          ]}
        />
      </Section>

      <Section title="Invoices">
        <DataTable
          rows={job.invoices}
          emptyLabel="No invoices yet."
          columns={[
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Total", cell: (r) => formatMoney(r.total) },
            {
              header: "Paid",
              cell: (r) => formatMoney(r.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0)),
            },
            { header: "Due", cell: (r) => formatDate(r.dueDate) },
          ]}
        />
      </Section>
    </div>
  );
}
