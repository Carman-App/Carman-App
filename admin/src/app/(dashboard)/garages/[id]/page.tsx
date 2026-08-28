import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getGarage(id: string) {
  return prisma.garage.findUnique({
    where: { id },
    include: {
      owner: { include: { user: true } },
      members: { include: { account: { include: { user: true } } } },
      invitations: true,
      vehicles: true,
    },
  });
}

export default async function GarageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ACCOUNTS_ROLES);
  const { id } = await params;
  const garage = await getGarage(id);
  if (!garage) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/garages" className="text-sm text-neutral-500 hover:text-neutral-200">
          ← Garages
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-100">{garage.name}</h1>
      </div>

      <DetailView
        title="Garage"
        fields={[
          { label: "Location", value: garage.location },
          {
            label: "Owner",
            value: (
              <Link href={`/accounts/${garage.ownerId}`} className="hover:underline">
                {garage.owner.user.name}
              </Link>
            ),
          },
          { label: "Created", value: formatDateTime(garage.createdAt) },
          { label: "Garage ID", value: garage.id },
        ]}
      />

      <Section title="Vehicles">
        <DataTable
          rows={garage.vehicles}
          href={(r) => `/vehicles/${r.id}`}
          emptyLabel="No vehicles yet."
          columns={[
            { header: "Vehicle", cell: (r) => `${r.year} ${r.make} ${r.model}` },
            { header: "Plate", cell: (r) => r.plate },
            { header: "Type", cell: (r) => <Badge value={r.type} /> },
          ]}
        />
      </Section>

      <Section title="Members">
        <DataTable
          rows={garage.members}
          href={(r) => `/accounts/${r.accountId}`}
          emptyLabel="Only the owner, so far."
          columns={[
            { header: "Name", cell: (r) => r.displayName || r.account.user.name },
            { header: "Role", cell: (r) => <Badge value={r.role} /> },
            { header: "Joined", cell: (r) => formatDate(r.joinedAt) },
          ]}
        />
      </Section>

      <Section title="Pending invitations">
        <DataTable
          rows={garage.invitations.filter((i) => i.status === "PENDING")}
          emptyLabel="No pending invitations."
          columns={[
            { header: "Email", cell: (r) => r.email },
            { header: "Role", cell: (r) => <Badge value={r.role} /> },
            { header: "Expires", cell: (r) => formatDate(r.expiresAt) },
          ]}
        />
      </Section>
    </div>
  );
}
