import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView } from "@/components/detail-view";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES, TRUST_DANGEROUS_ROLES } from "@/lib/auth/rbac";
import { TakedownForm } from "./takedown-form";

export const dynamic = "force-dynamic";

export default async function TakedownDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(TRUST_ROLES);
  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    include: { documentType: true, vehicle: true },
  });
  if (!document) notFound();

  const canTakedown = TRUST_DANGEROUS_ROLES.includes(session.role);
  const takenDownBy = document.takedownByAdminId
    ? await prisma.adminUser.findUnique({ where: { id: document.takedownByAdminId }, select: { name: true } })
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/documents" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Documents
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">{document.title}</h1>
      </div>

      <DetailView
        title="Document"
        fields={[
          { label: "Type", value: document.documentType.label },
          {
            label: "Vehicle",
            value: (
              <Link href={`/vehicles/${document.vehicleId}`} className="hover:underline">
                {document.vehicle.year} {document.vehicle.make} {document.vehicle.model}
              </Link>
            ),
          },
          { label: "Expires", value: formatDate(document.expiryDate) },
          { label: "Added", value: formatDate(document.addedAt) },
          {
            label: "File",
            value: document.takedownAt ? "[Image removed — see takedown reason below]" : (document.fileKey ?? "No file uploaded"),
          },
          document.takedownAt
            ? { label: "Taken down", value: `${formatDateTime(document.takedownAt)} by ${takenDownBy?.name ?? document.takedownByAdminId}` }
            : { label: "Taken down", value: "No" },
          ...(document.takedownAt ? [{ label: "Takedown reason", value: document.takedownReason ?? "—" }] : []),
        ]}
      />

      {!document.takedownAt && canTakedown && <TakedownForm documentId={document.id} />}
      {!document.takedownAt && !canTakedown && (
        <p className="text-sm text-neutral-500">Only an Owner-role admin can take down a document.</p>
      )}
    </div>
  );
}
