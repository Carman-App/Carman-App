import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function DisclosureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(TRUST_ROLES);
  const { id } = await params;
  const record = await prisma.disclosureRequest.findUnique({ where: { id } });
  if (!record) notFound();

  const approver = await prisma.adminUser.findUnique({ where: { id: record.approvedByAdminId }, select: { name: true } });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trust/disclosures" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Disclosure requests
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">
          {record.requesterOrg} — {record.requesterName}
        </h1>
        <Badge value={record.requestType} />
      </div>

      <DetailView
        title="Disclosure record"
        fields={[
          { label: "Legal authority", value: record.legalAuthority },
          { label: "What was disclosed", value: record.whatWasDisclosed },
          {
            label: "Related account",
            value: record.relatedAccountId ? (
              <Link href={`/accounts/${record.relatedAccountId}`} className="hover:underline">
                {record.relatedAccountId}
              </Link>
            ) : (
              "—"
            ),
          },
          { label: "Related entity", value: record.relatedEntityType ? `${record.relatedEntityType} (${record.relatedEntityId ?? "—"})` : "—" },
          { label: "Approved by", value: approver?.name ?? record.approvedByAdminId },
          { label: "User notified", value: record.userNotified ? `Yes — ${formatDateTime(record.userNotifiedAt)}` : "No" },
          { label: "Received", value: formatDateTime(record.receivedAt) },
          { label: "Responded", value: record.respondedAt ? formatDateTime(record.respondedAt) : "Not yet marked responded" },
          { label: "Recorded", value: formatDateTime(record.createdAt) },
        ]}
      />
    </div>
  );
}
