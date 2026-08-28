import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { DisputeStatus } from "@/generated/prisma/enums";
import { getDisputeEvidenceTrail } from "@/lib/trust/evidence-trail";
import { ResolveForm } from "./resolve-form";

export const dynamic = "force-dynamic";

async function getDispute(id: string) {
  return prisma.dispute.findUnique({
    where: { id },
    include: {
      job: true,
      vehicle: true,
      workshop: true,
    },
  });
}

export default async function DisputeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(TRUST_ROLES);
  const { id } = await params;
  const dispute = await getDispute(id);
  if (!dispute) notFound();

  const trail = await getDisputeEvidenceTrail(dispute);
  const resolverName = dispute.resolvedByAdminId
    ? (await prisma.adminUser.findUnique({ where: { id: dispute.resolvedByAdminId }, select: { name: true } }))?.name
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trust/disputes" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Disputes
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Dispute — {dispute.reason}</h1>
        <div className="mt-1 flex gap-2">
          <Badge value={dispute.kind} />
          <Badge value={dispute.status} />
        </div>
      </div>

      <DetailView
        title="Dispute"
        fields={[
          { label: "Workshop", value: dispute.workshop ? <Link href={`/workshops/${dispute.workshopId}`} className="hover:underline">{dispute.workshop.name}</Link> : "—" },
          { label: "Job", value: dispute.job ? <Link href={`/jobs/${dispute.jobId}`} className="hover:underline">{dispute.job.faultDescription}</Link> : "—" },
          { label: "Vehicle", value: dispute.vehicle ? <Link href={`/vehicles/${dispute.vehicleId}`} className="hover:underline">{dispute.vehicle.year} {dispute.vehicle.make} {dispute.vehicle.model}</Link> : "—" },
          { label: "Invoice id (plain reference)", value: dispute.invoiceId ?? "—" },
          { label: "Estimate id (plain reference)", value: dispute.estimateId ?? "—" },
          { label: "Raised by", value: dispute.raisedByAccountId ? <Link href={`/accounts/${dispute.raisedByAccountId}`} className="hover:underline">{dispute.raisedByAccountId}</Link> : "—" },
          { label: "Raised", value: formatDateTime(dispute.createdAt) },
          { label: "Resolution note", value: dispute.resolutionNote ?? "—" },
          { label: "Resolved", value: dispute.resolvedAt ? `${formatDateTime(dispute.resolvedAt)} by ${resolverName ?? dispute.resolvedByAdminId}` : "Not yet resolved" },
        ]}
      />

      <Section title="Evidence trail">
        <p className="text-xs text-neutral-500">
          Built from real rows only — job status history, inspections, estimates + decisions,
          invoices + payments, and any documents on the linked vehicle, in date order. There is no
          updatedAt on Invoice/Payment/Estimate in this schema, so &ldquo;edited&rdquo; markers
          aren&rsquo;t derivable — only chronologically impossible/implausible timestamps
          (&ldquo;entered late&rdquo;) are flagged below, in orange.
        </p>
        {trail.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing to show — this dispute has no jobId/vehicleId to join through, or the linked job
            has no estimates/invoices/inspections yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {trail.map((entry) => (
              <li
                key={entry.id}
                className={`rounded border p-3 text-sm ${
                  entry.anachrony ? "border-amber-200 bg-amber-50" : "border-neutral-200"
                }`}
              >
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{entry.kind}</span>
                  <span>{formatDateTime(entry.at)}</span>
                </div>
                <p className="text-neutral-800">{entry.summary}</p>
                {entry.anachrony && <p className="mt-1 text-xs text-amber-700">Entered late: {entry.anachrony}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {dispute.status === DisputeStatus.OPEN && (
        <Section title="Resolve">
          <ResolveForm disputeId={dispute.id} />
        </Section>
      )}
    </div>
  );
}
