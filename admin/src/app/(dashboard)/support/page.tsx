import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { requireRole, SUPPORT_ROLES, AdminRole } from "@/lib/auth/rbac";
import { TicketStatus } from "@/generated/prisma/enums";
import { getOpenPastADayCount } from "@/lib/support/metrics";

export const dynamic = "force-dynamic";

function ageLabel(createdAt: Date): string {
  const ms = Date.now() - createdAt.getTime();
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.max(1, Math.round(ms / (1000 * 60)))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

async function getWaitingTickets() {
  return prisma.ticket.findMany({
    where: { status: { in: [TicketStatus.OPEN, TicketStatus.PENDING] } },
    include: {
      account: { include: { user: true } },
    },
    orderBy: { createdAt: "asc" }, // SUP-01: oldest first
  });
}

async function getSupportAdminCount() {
  return prisma.adminUser.count({
    where: { role: { in: [AdminRole.OWNER, AdminRole.SUPPORT] }, disabledAt: null },
  });
}

export default async function SupportQueuePage() {
  await requireRole(SUPPORT_ROLES);
  const [tickets, supportAdminCount, openPastADay] = await Promise.all([
    getWaitingTickets(),
    getSupportAdminCount(),
    getOpenPastADayCount(),
  ]);

  const showAssignee = supportAdminCount > 1;
  const adminIds = [...new Set(tickets.map((t) => t.assignedAdminId).filter((id): id is string => Boolean(id)))];
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Ticket queue</h1>
          <p className="text-sm text-neutral-500">
            Everyone currently waiting (open or pending), oldest first. {openPastADay} ticket
            {openPastADay === 1 ? "" : "s"} have been waiting more than a day.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/support/metrics"
            className="whitespace-nowrap rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
          >
            Response metrics →
          </Link>
          <Link
            href="/support/consent"
            className="whitespace-nowrap rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
          >
            Consent sessions (SUP-03) →
          </Link>
          <Link
            href="/support/new"
            className="whitespace-nowrap rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700"
          >
            Log a ticket
          </Link>
        </div>
      </div>

      <DataTable
        rows={tickets}
        href={(row) => `/support/${row.id}`}
        emptyLabel="Nobody's waiting."
        columns={[
          { header: "Age", cell: (r) => ageLabel(r.createdAt) },
          { header: "Status", cell: (r) => <Badge value={r.status} /> },
          { header: "Channel", cell: (r) => <Badge value={r.channel} /> },
          { header: "Account", cell: (r) => r.account.user.name },
          { header: "Plan", cell: (r) => r.attachedPlan ?? "—" },
          { header: "Subject", cell: (r) => r.subject },
          ...(showAssignee
            ? [
                {
                  header: "Assignee",
                  cell: (r: (typeof tickets)[number]) =>
                    r.assignedAdminId ? (adminNames.get(r.assignedAdminId) ?? r.assignedAdminId) : "Unassigned",
                },
              ]
            : []),
          { header: "Opened", cell: (r) => formatDateTime(r.createdAt) },
        ]}
      />

      <Section title="About the technical-state snapshot (SUP-02)">
        <p className="text-sm text-neutral-500">
          Country, plan, and payment state are captured for real from the account&rsquo;s region and
          current subscription at the moment a ticket is opened. Device, app build, and recent
          errors are not shown anywhere — no telemetry table exists in this product yet, so there is
          nothing honest to attach for those fields.
        </p>
      </Section>
    </div>
  );
}
