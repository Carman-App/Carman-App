import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { AbuseReportStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

async function getReports() {
  return prisma.abuseReport.findMany({
    include: {
      reportedAccount: { include: { user: true } },
      reporterAccount: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export default async function TrustLandingPage() {
  await requireRole(TRUST_ROLES);
  const reports = await getReports();
  const openCount = reports.filter(
    (r) => r.status === AbuseReportStatus.OPEN || r.status === AbuseReportStatus.IN_REVIEW,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Reports & disputes</h1>
          <p className="text-sm text-neutral-500">
            {openCount} report{openCount === 1 ? "" : "s"} open or in review.
          </p>
        </div>
        <Link
          href="/trust/reports/new"
          className="whitespace-nowrap rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
        >
          Log a report
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/trust/disputes" className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500">
          Disputes (TRUST-02) →
        </Link>
        <Link href="/trust/restrictions" className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500">
          Capability restrictions (TRUST-03) →
        </Link>
        <Link href="/trust/linked-accounts" className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500">
          Linked accounts (TRUST-04) →
        </Link>
        <Link href="/trust/disclosures" className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500">
          Disclosure requests (TRUST-06) →
        </Link>
      </div>

      <DataTable
        rows={reports}
        href={(row) => `/trust/reports/${row.id}`}
        emptyLabel="No reports logged yet. There is no in-app 'report' button in the mobile app yet — reports arrive via phone/email and are logged here."
        columns={[
          { header: "Reported account", cell: (r) => r.reportedAccount.user.name },
          { header: "Reporter", cell: (r) => r.reporterAccount?.user.name ?? "Anonymous / external" },
          { header: "Reason", cell: (r) => r.reason },
          { header: "State", cell: (r) => <Badge value={r.status} /> },
          { header: "Action taken", cell: (r) => r.actionTaken ?? "—" },
          { header: "Reported", cell: (r) => formatDateTime(r.createdAt) },
        ]}
      />
    </div>
  );
}
