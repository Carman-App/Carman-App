import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, SUPPORT_ROLES, AdminRole } from "@/lib/auth/rbac";
import { TicketStatus } from "@/generated/prisma/enums";
import { ReplyForm, LogInboundForm } from "./reply-form";
import { CloseTicketForm, ReopenTicketForm } from "./close-ticket-form";
import { AssignForm } from "./assign-form";

export const dynamic = "force-dynamic";

async function getTicket(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      account: { include: { user: true } },
      messages: { orderBy: { sentAt: "asc" } },
    },
  });
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(SUPPORT_ROLES);
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const supportAdmins = await prisma.adminUser.findMany({
    where: { role: { in: [AdminRole.OWNER, AdminRole.SUPPORT] }, disabledAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const showAssignee = supportAdmins.length > 1;

  const sentByIds = [
    ...new Set(ticket.messages.map((m) => m.sentByAdminId).filter((v): v is string => Boolean(v))),
  ];
  const senderNames = sentByIds.length
    ? new Map(
        (await prisma.adminUser.findMany({ where: { id: { in: sentByIds } }, select: { id: true, name: true } })).map(
          (a) => [a.id, a.name],
        ),
      )
    : new Map<string, string>();

  const isClosed = ticket.status === TicketStatus.CLOSED;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/support" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Ticket queue
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">{ticket.subject}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge value={ticket.status} />
          <Badge value={ticket.channel} />
          {ticket.category && <Badge value={ticket.category} />}
        </div>
      </div>

      <DetailView
        title="Ticket"
        fields={[
          {
            label: "Account",
            value: (
              <Link href={`/accounts/${ticket.accountId}`} className="hover:underline">
                {ticket.account.user.name} ({ticket.account.user.email})
              </Link>
            ),
          },
          { label: "Opened", value: formatDateTime(ticket.createdAt) },
          { label: "First response", value: ticket.firstRespondedAt ? formatDateTime(ticket.firstRespondedAt) : "Not yet responded to" },
          { label: "Resolved", value: ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : "—" },
          { label: "Closed", value: ticket.closedAt ? formatDateTime(ticket.closedAt) : "—" },
          { label: "Resolution note", value: ticket.resolutionNote ?? "—" },
        ]}
      />

      <Section title="Technical state at open (SUP-02)">
        <DetailView
          title="Snapshot"
          subtitle="Captured once, at ticket open, from the account's real region and subscription — not live."
          fields={[
            { label: "Country", value: ticket.attachedCountry ?? "—" },
            { label: "Plan", value: ticket.attachedPlan ?? "—" },
            { label: "Payment state", value: ticket.attachedPaymentState ?? "—" },
            { label: "Device", value: "Not tracked — no telemetry exists." },
            { label: "App build", value: "Not tracked — no telemetry exists." },
            { label: "Recent errors", value: "Not tracked — no telemetry exists." },
          ]}
        />
      </Section>

      {showAssignee && (
        <Section title="Assignee">
          <AssignForm ticketId={ticket.id} currentAssigneeId={ticket.assignedAdminId} admins={supportAdmins} />
        </Section>
      )}

      <Section title="Message thread">
        <div className="space-y-2">
          {ticket.messages.length === 0 && <p className="text-sm text-neutral-500">No messages yet.</p>}
          {ticket.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded border p-3 text-sm ${
                m.direction === "INBOUND"
                  ? "border-neutral-200 bg-neutral-50"
                  : "border-sky-200 bg-sky-50"
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
                <span>
                  {m.direction === "INBOUND" ? "From account" : `From ${(m.sentByAdminId && senderNames.get(m.sentByAdminId)) ?? "admin"}`}{" "}
                  via {m.channel}
                </span>
                <span className="flex items-center gap-2">
                  <Badge value={m.deliveryState} />
                  {formatDateTime(m.sentAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-neutral-800">{m.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {!isClosed && (
        <Section title="Reply">
          <ReplyForm ticketId={ticket.id} channel={ticket.channel} />
        </Section>
      )}

      <Section title="Log inbound contact">
        <LogInboundForm ticketId={ticket.id} />
      </Section>

      <Section title="Close (SUP-06)">
        {isClosed ? <ReopenTicketForm ticketId={ticket.id} /> : <CloseTicketForm ticketId={ticket.id} />}
      </Section>
    </div>
  );
}
