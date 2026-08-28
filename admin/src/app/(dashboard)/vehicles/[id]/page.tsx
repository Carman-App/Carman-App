import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRecordsFeed } from "@/lib/records";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getVehicle(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      garage: { include: { owner: { include: { user: true } } } },
      documents: { where: { deletedAt: null }, include: { documentType: true }, take: 20 },
      reminders: { where: { resolved: false }, take: 20 },
      jobs: { include: { workshop: true }, take: 10, orderBy: { createdAt: "desc" } },
    },
  });
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ACCOUNTS_ROLES);
  const { id } = await params;
  const [vehicle, records] = await Promise.all([
    getVehicle(id),
    getRecordsFeed({ vehicleId: id, take: 30 }),
  ]);
  if (!vehicle) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vehicles" className="text-sm text-neutral-500 hover:text-neutral-200">
          ← Vehicles
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-100">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </h1>
      </div>

      <DetailView
        title="Vehicle"
        fields={[
          { label: "Plate", value: vehicle.plate },
          { label: "Type", value: <Badge value={vehicle.type} /> },
          { label: "Usage", value: <Badge value={vehicle.usage} /> },
          { label: "Powertrain", value: vehicle.powertrain ?? "—" },
          { label: "Odometer", value: `${vehicle.odometerKm.toLocaleString()} km` },
          { label: "Next service due", value: vehicle.nextServiceDueKm ? `${vehicle.nextServiceDueKm.toLocaleString()} km` : "—" },
          { label: "VIN", value: vehicle.vin ?? "—" },
          {
            label: "Garage",
            value: (
              <Link href={`/garages/${vehicle.garageId}`} className="hover:underline">
                {vehicle.garage.name}
              </Link>
            ),
          },
          {
            label: "Owner",
            value: (
              <Link href={`/accounts/${vehicle.garage.ownerId}`} className="hover:underline">
                {vehicle.garage.owner.user.name}
              </Link>
            ),
          },
        ]}
      />

      <Section title="Recent history">
        <DataTable
          rows={records}
          emptyLabel="No fuel, service, repair, expense, or odometer records yet."
          columns={[
            { header: "Date", cell: (r) => formatDate(r.date) },
            { header: "Type", cell: (r) => <Badge value={r.kind} /> },
            { header: "Description", cell: (r) => r.description },
            { header: "Amount", cell: (r) => (r.amount ? formatMoney(r.amount) : "—") },
            { header: "Entered by", cell: (r) => r.enteredByName },
          ]}
        />
      </Section>

      <Section title="Documents">
        <DataTable
          rows={vehicle.documents}
          emptyLabel="No documents on file."
          columns={[
            { header: "Title", cell: (r) => r.title },
            { header: "Type", cell: (r) => r.documentType.label },
            { header: "Expires", cell: (r) => formatDate(r.expiryDate) },
          ]}
        />
      </Section>

      <Section title="Open reminders">
        <DataTable
          rows={vehicle.reminders}
          emptyLabel="Nothing due."
          columns={[
            { header: "Kind", cell: (r) => <Badge value={r.kind} /> },
            { header: "Description", cell: (r) => r.description },
            { header: "Due", cell: (r) => (r.dueDate ? formatDate(r.dueDate) : r.dueKm ? `${r.dueKm.toLocaleString()} km` : "—") },
          ]}
        />
      </Section>

      <Section title="Workshop jobs">
        <DataTable
          rows={vehicle.jobs}
          href={(r) => `/jobs/${r.id}`}
          emptyLabel="No workshop has worked on this vehicle."
          columns={[
            { header: "Workshop", cell: (r) => r.workshop.name },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Opened", cell: (r) => formatDate(r.createdAt) },
          ]}
        />
      </Section>
    </div>
  );
}
