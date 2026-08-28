import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { requireRole, WORK_ROLES, WORKSHOP_VERIFICATION_ROLES, WORK_CONTACT_LOG_ROLES } from "@/lib/auth/rbac";
import { TERMINAL_JOB_STATUSES } from "@/lib/work/job-aging";
import { getWorkshopBalanceWarning } from "@/lib/work/mechanic-money";
import { VerificationPanel } from "./verification-panel";
import { ContactLogPanel } from "./contact-log-panel";

export const dynamic = "force-dynamic";

async function getWorkshop(id: string) {
  return prisma.workshop.findUnique({
    where: { id },
    include: {
      owner: { include: { user: true } },
      members: {
        include: {
          account: { include: { user: true } },
          jobAssignments: { include: { job: { select: { status: true } } } },
        },
      },
      customers: { take: 20, orderBy: { createdAt: "desc" } },
      jobs: { take: 20, orderBy: { createdAt: "desc" }, include: { customer: true } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" } },
      verifications: { orderBy: { createdAt: "desc" } },
      contactLogs: { orderBy: { occurredAt: "desc" }, take: 50 },
    },
  });
}

export default async function WorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(WORK_ROLES);
  const { id } = await params;
  const workshop = await getWorkshop(id);
  if (!workshop) notFound();

  const canManageVerification = WORKSHOP_VERIFICATION_ROLES.includes(session.role);
  const canLogContact = WORK_CONTACT_LOG_ROLES.includes(session.role);
  const balanceWarning = await getWorkshopBalanceWarning(id);

  const bench = workshop.members.map((member) => {
    const openLoad = member.jobAssignments.filter((a) => !TERMINAL_JOB_STATUSES.includes(a.job.status)).length;
    return { ...member, jobCount: member.jobAssignments.length, openLoad };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/workshops" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Workshops
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">{workshop.name}</h1>
      </div>

      {balanceWarning.overdueInvoiceCount > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Balance warning:</strong> {balanceWarning.overdueInvoiceCount} overdue unpaid invoice
          {balanceWarning.overdueInvoiceCount === 1 ? "" : "s"} totalling {formatMoney(balanceWarning.overdueTotal)}.
          This mirrors what the workshop owner would see as their own balance warning in their app, not an
          admin-only number.
        </div>
      )}

      <DetailView
        title="Workshop"
        fields={[
          {
            label: "Owner",
            value: (
              <Link href={`/accounts/${workshop.ownerId}`} className="hover:underline">
                {workshop.owner.user.name}
              </Link>
            ),
          },
          {
            label: "Verified",
            value: workshop.verifiedBadge ? (
              <span className="text-emerald-600">
                Yes — since {workshop.verifiedAt ? formatDateTime(workshop.verifiedAt) : "—"}
              </span>
            ) : (
              <span className="text-neutral-500">Not verified</span>
            ),
          },
          { label: "Created", value: formatDateTime(workshop.createdAt) },
          { label: "Workshop ID", value: workshop.id },
        ]}
      />

      <Section title="Verification">
        {canManageVerification ? (
          <VerificationPanel
            workshopId={workshop.id}
            verifiedBadge={workshop.verifiedBadge}
            verifiedAt={workshop.verifiedAt}
            history={workshop.verifications}
          />
        ) : (
          <p className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {workshop.verifiedBadge
              ? `Verified since ${workshop.verifiedAt ? formatDateTime(workshop.verifiedAt) : "—"}.`
              : "Not verified."}{" "}
            Granting or revoking verification is Owner-only.
          </p>
        )}
      </Section>

      <Section title="Subscriptions">
        <DataTable
          rows={workshop.subscriptions}
          emptyLabel="No subscription on file — treated as unlimited by plan-limit checks."
          columns={[
            { header: "Plan", cell: (r) => r.plan.name },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Trial ends", cell: (r) => formatDate(r.trialEndsAt) },
          ]}
        />
      </Section>

      <Section title="The bench (staff)">
        <DataTable
          rows={bench}
          href={(r) => `/accounts/${r.accountId}`}
          emptyLabel="Only the owner, so far."
          columns={[
            { header: "Name", cell: (r) => r.displayName || r.account.user.name },
            { header: "Role", cell: (r) => <Badge value={r.role} /> },
            { header: "Jobs assigned", cell: (r) => r.jobCount },
            { header: "Open load", cell: (r) => r.openLoad },
            { header: "Joined", cell: (r) => formatDate(r.joinedAt) },
          ]}
        />
      </Section>

      <Section title="Customer book">
        <DataTable
          rows={workshop.customers}
          emptyLabel="No customers on file yet."
          columns={[
            { header: "Name", cell: (r) => r.name },
            { header: "Phone", cell: (r) => r.phone ?? "—" },
            { header: "On Carma", cell: (r) => (r.linkedAccountId ? "Yes" : "No") },
          ]}
        />
      </Section>

      <Section title="Jobs">
        <DataTable
          rows={workshop.jobs}
          href={(r) => `/jobs/${r.id}`}
          emptyLabel="No jobs yet."
          columns={[
            { header: "Customer", cell: (r) => r.customer.name },
            { header: "Fault", cell: (r) => r.faultDescription },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Opened", cell: (r) => formatDate(r.createdAt) },
          ]}
        />
      </Section>

      <Section title="Contact log">
        {canLogContact ? (
          <ContactLogPanel workshopId={workshop.id} history={workshop.contactLogs} />
        ) : (
          <p className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {workshop.contactLogs.length} contact{workshop.contactLogs.length === 1 ? "" : "s"} logged.
          </p>
        )}
      </Section>
    </div>
  );
}
