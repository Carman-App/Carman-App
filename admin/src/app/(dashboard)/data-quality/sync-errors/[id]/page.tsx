import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, DATA_QUALITY_ROLES } from "@/lib/auth/rbac";
import { DetailView } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SyncErrorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(DATA_QUALITY_ROLES);
  const { id } = await params;

  const error = await prisma.syncError.findUnique({
    where: { id },
    include: { account: { include: { user: true } } },
  });
  if (!error) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/data-quality/sync-errors" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Sync errors
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Sync error</h1>
        <p className="text-sm text-neutral-500">Read-only — reported by a client, not editable here.</p>
      </div>

      <DetailView
        title={error.operation}
        subtitle={error.message}
        fields={[
          { label: "Account", value: error.account ? <Link href={`/accounts/${error.account.id}`} className="hover:underline">{error.account.user.name}</Link> : "Unknown / unlinked" },
          { label: "Device info", value: error.deviceInfo ?? "Not reported" },
          { label: "Operation", value: error.operation },
          { label: "Message", value: error.message },
          { label: "Occurred at (client-reported)", value: formatDateTime(error.occurredAt) },
          { label: "Reported at (row written)", value: formatDateTime(error.reportedAt) },
          { label: "Resolved at", value: error.resolvedAt ? formatDateTime(error.resolvedAt) : "Not resolved" },
          {
            label: "Metadata",
            value: error.metadata ? (
              <pre className="whitespace-pre-wrap break-all text-xs text-neutral-600">{JSON.stringify(error.metadata, null, 2)}</pre>
            ) : (
              "None"
            ),
          },
        ]}
      />
    </div>
  );
}
