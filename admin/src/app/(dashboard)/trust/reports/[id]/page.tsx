import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { AbuseReportStatus } from "@/generated/prisma/enums";
import { InReviewButton, DecideForm } from "./decide-form";

export const dynamic = "force-dynamic";

async function getReport(id: string) {
  return prisma.abuseReport.findUnique({
    where: { id },
    include: {
      reportedAccount: { include: { user: true } },
      reporterAccount: { include: { user: true } },
    },
  });
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(TRUST_ROLES);
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const decided = report.status === AbuseReportStatus.ACTIONED || report.status === AbuseReportStatus.DISMISSED;
  const decidedByName = report.decidedByAdminId
    ? (await prisma.adminUser.findUnique({ where: { id: report.decidedByAdminId }, select: { name: true } }))?.name
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trust" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Reports & disputes
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Report — {report.reason}</h1>
        <Badge value={report.status} />
      </div>

      <DetailView
        title="Report"
        fields={[
          {
            label: "Reported account",
            value: (
              <Link href={`/accounts/${report.reportedAccountId}`} className="hover:underline">
                {report.reportedAccount.user.name} ({report.reportedAccount.user.email})
              </Link>
            ),
          },
          {
            label: "Reporter",
            value: report.reporterAccount ? (
              <Link href={`/accounts/${report.reporterAccountId}`} className="hover:underline">
                {report.reporterAccount.user.name} ({report.reporterAccount.user.email})
              </Link>
            ) : (
              "Anonymous / external — no reporter account on file"
            ),
          },
          { label: "Reported entity", value: report.reportedEntityType ? `${report.reportedEntityType} (${report.reportedEntityId ?? "—"})` : "—" },
          { label: "Description", value: report.description ?? "—" },
          { label: "Reported", value: formatDateTime(report.createdAt) },
          {
            label: "Decided",
            value: report.decidedAt ? `${formatDateTime(report.decidedAt)} by ${decidedByName ?? report.decidedByAdminId}` : "Not yet decided",
          },
          { label: "Action taken", value: report.actionTaken ?? "—" },
        ]}
      />

      {!decided && (
        <div className="space-y-3">
          {report.status === AbuseReportStatus.OPEN && <InReviewButton reportId={report.id} />}
          <DecideForm reportId={report.id} />
        </div>
      )}

      <p className="text-xs text-neutral-500">
        This report is kept on both the reported and (when known) reporter accounts&rsquo; history —
        see each account&rsquo;s Trust & safety section.
      </p>
    </div>
  );
}
