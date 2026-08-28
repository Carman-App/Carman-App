import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getWorkshop(id: string) {
  return prisma.workshop.findUnique({
    where: { id },
    include: {
      owner: { include: { user: true } },
      members: { include: { account: { include: { user: true } } } },
      customers: { take: 20, orderBy: { createdAt: "desc" } },
      jobs: { take: 20, orderBy: { createdAt: "desc" }, include: { customer: true } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ACCOUNTS_ROLES);
  const { id } = await params;
  const workshop = await getWorkshop(id);
  if (!workshop) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/workshops" className="text-sm text-neutral-500 hover:text-neutral-200">
          ← Workshops
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-100">{workshop.name}</h1>
      </div>

      <DetailView
        title="Workshop"
        fields={[
          {
            label: "Owner",
            value: (
              <Link href={`/accounts/${workshop.ownerId}`} className="hover:underline">
                {workshop.owner.user.name}
              </Link>
            ),
          },
          { label: "Created", value: formatDateTime(workshop.createdAt) },
          { label: "Workshop ID", value: workshop.id },
        ]}
      />

      <Section title="Subscriptions">
        <DataTable
          rows={workshop.subscriptions}
          emptyLabel="No subscription on file — treated as unlimited by plan-limit checks."
          columns={[
            { header: "Plan", cell: (r) => r.plan.name },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Trial ends", cell: (r) => formatDate(r.trialEndsAt) },
          ]}
        />
      </Section>

      <Section title="The bench (staff)">
        <DataTable
          rows={workshop.members}
          href={(r) => `/accounts/${r.accountId}`}
          emptyLabel="Only the owner, so far."
          columns={[
            { header: "Name", cell: (r) => r.displayName || r.account.user.name },
            { header: "Role", cell: (r) => <Badge value={r.role} /> },
            { header: "Joined", cell: (r) => formatDate(r.joinedAt) },
          ]}
        />
      </Section>

      <Section title="Customer book">
        <DataTable
          rows={workshop.customers}
          emptyLabel="No customers on file yet."
          columns={[
            { header: "Name", cell: (r) => r.name },
            { header: "Phone", cell: (r) => r.phone ?? "—" },
            { header: "On Carma", cell: (r) => (r.linkedAccountId ? "Yes" : "No") },
          ]}
        />
      </Section>

      <Section title="Jobs">
        <DataTable
          rows={workshop.jobs}
          href={(r) => `/jobs/${r.id}`}
          emptyLabel="No jobs yet."
          columns={[
            { header: "Customer", cell: (r) => r.customer.name },
            { header: "Fault", cell: (r) => r.faultDescription },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Opened", cell: (r) => formatDate(r.createdAt) },
          ]}
        />
      </Section>
    </div>
  );
}
