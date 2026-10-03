import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * What the app shows on a vehicle that the console was missing: which
 * workshops can see it, builds (project vehicles), inspections, and the
 * estimates and invoices sent to the owner.
 */

/** Workshop access: requests from the app's "asked to see a vehicle" and grants the owner approved. */
export async function AccessSection({ vehicleId }: { vehicleId: string }) {
  const now = new Date();
  const [requests, grants] = await Promise.all([
    prisma.accessRequest.findMany({ where: { vehicleId }, include: { workshop: true }, orderBy: { requestedAt: "desc" }, take: 20 }),
    prisma.accessGrant.findMany({ where: { vehicleId }, include: { workshop: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return (
    <div className="space-y-3">
      <DataTable
        rows={grants}
        href={(r) => `/workshops/${r.workshopId}`}
        emptyLabel="No workshop has been given access."
        columns={[
          { header: "Workshop with access", cell: (r) => r.workshop.name },
          { header: "Scope", cell: (r) => r.scope },
          { header: "From", cell: (r) => formatDate(r.startAt) },
          { header: "Until", cell: (r) => formatDate(r.expiresAt) },
          { header: "State", cell: (r) => <Badge value={r.revokedAt ? "REVOKED" : r.expiresAt < now ? "EXPIRED" : "ACTIVE"} /> },
        ]}
      />
      <DataTable
        rows={requests}
        href={(r) => `/workshops/${r.workshopId}`}
        emptyLabel="No access requests."
        columns={[
          { header: "Requested by", cell: (r) => r.workshop.name },
          { header: "Scope", cell: (r) => r.scope },
          { header: "Asked", cell: (r) => formatDateTime(r.requestedAt) },
          { header: "Answer", cell: (r) => <Badge value={r.status} /> },
        ]}
      />
    </div>
  );
}

/** Project vehicles: the build, its budget and stages. */
export async function BuildsSection({ vehicleId }: { vehicleId: string }) {
  const projects = await prisma.project.findMany({
    where: { vehicleId },
    include: { stages: { include: { _count: { select: { modifications: true, parts: true } } }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  if (projects.length === 0) return <p className="text-sm text-neutral-500">No build on this vehicle.</p>;
  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <div key={p.id} className="space-y-2">
          <p className="text-sm text-neutral-700">
            <span className="font-medium">{p.name ?? "Build"}</span> · budget {Number(p.budget).toLocaleString()} · spent {Number(p.spent).toLocaleString()} · started {formatDate(p.createdAt)}
          </p>
          <DataTable
            rows={p.stages}
            emptyLabel="No stages yet."
            columns={[
              { header: "Stage", cell: (s) => s.name },
              { header: "Status", cell: (s) => <Badge value={s.status} /> },
              { header: "Modifications", cell: (s) => s._count.modifications },
              { header: "Parts", cell: (s) => s._count.parts },
            ]}
          />
        </div>
      ))}
    </div>
  );
}

/** Inspections, estimates and invoices workshops sent for this vehicle. */
export async function WorkshopPapersSection({ vehicleId }: { vehicleId: string }) {
  const [inspections, estimates, invoices] = await Promise.all([
    prisma.inspection.findMany({ where: { vehicleId }, include: { workshop: true, _count: { select: { items: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.estimate.findMany({ where: { vehicleId }, include: { workshop: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.invoice.findMany({ where: { vehicleId }, include: { workshop: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return (
    <div className="space-y-3">
      <DataTable
        rows={inspections}
        emptyLabel="No inspections."
        columns={[
          { header: "Inspection", cell: (r) => r.summary },
          { header: "Workshop", cell: (r) => r.workshop.name },
          { header: "Items checked", cell: (r) => r._count.items },
          { header: "Date", cell: (r) => formatDate(r.createdAt) },
        ]}
      />
      <DataTable
        rows={estimates}
        emptyLabel="No estimates."
        columns={[
          { header: "Estimate from", cell: (r) => r.workshop.name },
          { header: "Total", cell: (r) => Number(r.total).toLocaleString() },
          { header: "Status", cell: (r) => <Badge value={r.status} /> },
          { header: "Date", cell: (r) => formatDate(r.createdAt) },
        ]}
      />
      <DataTable
        rows={invoices}
        emptyLabel="No invoices."
        columns={[
          { header: "Invoice from", cell: (r) => r.workshop.name },
          { header: "Total", cell: (r) => Number(r.total).toLocaleString() },
          { header: "Status", cell: (r) => <Badge value={r.status} /> },
          { header: "Date", cell: (r) => formatDate(r.createdAt) },
        ]}
      />
    </div>
  );
}
