import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRecordsFeed, getRecordsCount } from "@/lib/records";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";
import { flagOdometerTrail, MAX_PLAUSIBLE_KM_PER_DAY, type OdometerFlag } from "@/lib/garages/odometer-flags";

export const dynamic = "force-dynamic";

async function getVehicle(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      garage: { include: { owner: { include: { user: true } } } },
      documents: { where: { deletedAt: null }, include: { documentType: true }, take: 20 },
      reminders: { where: { resolved: false }, take: 20 },
      jobs: { include: { workshop: true }, take: 10, orderBy: { createdAt: "desc" } },
      odometerReadings: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      transfers: { orderBy: { createdAt: "desc" } },
    },
  });
}

function flagSummary(flag: OdometerFlag): string {
  switch (flag.type) {
    case "ROLLBACK":
      return `Rollback — ${flag.odometerKm.toLocaleString()} km on ${formatDate(flag.date)} is lower than the ${flag.previousOdometerKm.toLocaleString()} km reading on ${formatDate(flag.previousDate)}.`;
    case "IMPLAUSIBLE_JUMP":
      return `Implausible jump — ${Math.round(flag.kmPerDay).toLocaleString()} km/day between ${formatDate(flag.previousDate)} and ${formatDate(flag.date)} (plausible limit: ${MAX_PLAUSIBLE_KM_PER_DAY.toLocaleString()} km/day).`;
    case "DUPLICATE":
      return `Duplicate reading — ${flag.odometerKm.toLocaleString()} km logged again on ${formatDate(flag.date)}, already logged on ${formatDate(flag.duplicateOfDate)}.`;
  }
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

  const [totalRecordCount, totalDocumentCount, totalJobCount] = await Promise.all([
    getRecordsCount(id),
    prisma.document.count({ where: { vehicleId: id, deletedAt: null } }),
    prisma.job.count({ where: { vehicleId: id } }),
  ]);

  const odometerFlags = flagOdometerTrail(vehicle.odometerReadings);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/vehicles" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Vehicles
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">
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

      <Section title="Totals">
        <DetailView
          title="Counts"
          subtitle="Full totals across this vehicle's history — the sections below show recent/capped feeds."
          fields={[
            { label: "Records (fuel + service + repair + expense + odometer)", value: totalRecordCount },
            { label: "Documents on file", value: totalDocumentCount },
            { label: "Workshop jobs linked", value: totalJobCount },
          ]}
        />
      </Section>

      <Section title="Odometer trail">
        <DataTable
          rows={vehicle.odometerReadings}
          emptyLabel="No odometer readings logged yet."
          columns={[
            { header: "Date", cell: (r) => formatDate(r.date) },
            { header: "Reading", cell: (r) => `${r.odometerKm.toLocaleString()} km` },
            { header: "Entered by", cell: (r) => r.enteredByName },
            { header: "Account", cell: (r) => r.enteredByAccountId ?? "—" },
            { header: "Notes", cell: (r) => r.notes ?? "—" },
          ]}
        />
      </Section>

      <Section title="Odometer flags (GAR-04)">
        {odometerFlags.length === 0 ? (
          <p className="text-sm text-neutral-500">No rollback, implausible jump, or duplicate reading detected on this vehicle&rsquo;s trail.</p>
        ) : (
          <div className="rounded border border-amber-200 bg-amber-50">
            <p className="border-b border-amber-200 px-4 py-2 text-xs text-amber-700">
              Flagged — not corrected here. The console never edits an odometer reading; these are
              read-only annotations for follow-up.
            </p>
            <ul className="divide-y divide-neutral-200 text-sm">
              {odometerFlags.map((flag, i) => (
                <li key={i} className="px-4 py-2 text-neutral-700">
                  {flagSummary(flag)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

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

      <Section title="Sale / transfer history (GAR-06)">
        {vehicle.transfers.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No transfers recorded — Carma&rsquo;s vehicle handover flow doesn&rsquo;t exist in the
            app yet, so there&rsquo;s nothing to show here yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Date</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">From garage</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">From account</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">To garage</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">To account</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Handover code</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Confirmed</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Items transferred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {vehicle.transfers.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap px-4 py-2">{formatDateTime(t.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{t.fromGarageId ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2">{t.fromAccountId ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2">{t.toGarageId ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2">{t.toAccountId ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{t.handoverCode ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2">{t.confirmedAt ? formatDateTime(t.confirmedAt) : "Not confirmed"}</td>
                    <td className="max-w-xs truncate px-4 py-2">
                      {t.itemsTransferred ? JSON.stringify(t.itemsTransferred) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
