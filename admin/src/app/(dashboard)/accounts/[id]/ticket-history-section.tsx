import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";

// SUP-07 — one chronological history per account: tickets, messages sent,
// admin actions, and grants/restrictions given, merged into a single feed.
// "Admin actions" and "grants given" both come out of AuditLog
// (writeAdminAuditLog is called for every write across Support and Trust &
// Safety, including capability-restriction creation/lifting), plus
// CapabilityRestriction rows are also listed directly since a restriction
// is unambiguously something "given" to this account.

type TimelineEntry = {
  id: string;
  at: Date;
  kind: "Ticket opened" | "Ticket closed" | "Message" | "Admin action" | "Restriction";
  summary: string;
  href?: string;
};

export async function TicketHistorySection({ accountId }: { accountId: string }) {
  const [tickets, auditEntries, restrictions] = await Promise.all([
    prisma.ticket.findMany({
      where: { accountId },
      include: { messages: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { targetAccountId: accountId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.capabilityRestriction.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const adminIds = [
    ...new Set([
      ...auditEntries.map((e) => e.actorId).filter((v): v is string => Boolean(v)),
      ...tickets.flatMap((t) => t.messages.map((m) => m.sentByAdminId)).filter((v): v is string => Boolean(v)),
      ...restrictions.map((r) => r.createdByAdminId),
    ]),
  ];
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, a.name]));

  const entries: TimelineEntry[] = [];

  for (const t of tickets) {
    entries.push({
      id: `ticket-open:${t.id}`,
      at: t.createdAt,
      kind: "Ticket opened",
      summary: `${t.subject} (${t.channel})`,
      href: `/support/${t.id}`,
    });
    if (t.closedAt) {
      entries.push({
        id: `ticket-close:${t.id}`,
        at: t.closedAt,
        kind: "Ticket closed",
        summary: `${t.subject}${t.category ? ` — ${t.category}` : ""}`,
        href: `/support/${t.id}`,
      });
    }
    for (const m of t.messages) {
      entries.push({
        id: `message:${m.id}`,
        at: m.sentAt,
        kind: "Message",
        summary: `${m.direction === "INBOUND" ? "Inbound from account" : `Outbound from ${(m.sentByAdminId && adminNames.get(m.sentByAdminId)) ?? "admin"}`} via ${m.channel} (${m.deliveryState})`,
        href: `/support/${t.id}`,
      });
    }
  }

  for (const e of auditEntries) {
    entries.push({
      id: `audit:${e.id}`,
      at: e.createdAt,
      kind: "Admin action",
      summary: `${e.action}${e.reason ? ` — ${e.reason}` : ""} (${(e.actorId && adminNames.get(e.actorId)) ?? e.actorId ?? "system"})`,
    });
  }

  for (const r of restrictions) {
    entries.push({
      id: `restriction:${r.id}`,
      at: r.createdAt,
      kind: "Restriction",
      summary: `${r.capability} restricted by ${adminNames.get(r.createdByAdminId) ?? r.createdByAdminId} — ${r.reason}`,
      href: "/trust/restrictions",
    });
  }

  entries.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <Section title="Ticket & account history (SUP-07)">
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-500">No tickets, messages, or admin actions recorded yet.</p>
      ) : (
        <ol className="space-y-1">
          {entries.slice(0, 100).map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 rounded border border-neutral-200 px-3 py-2 text-sm">
              <span className="w-36 shrink-0 text-xs text-neutral-500">{formatDateTime(entry.at)}</span>
              <Badge value={entry.kind.toUpperCase().replace(/ /g, "_")} />
              {entry.href ? (
                <Link href={entry.href} className="text-neutral-800 hover:underline">
                  {entry.summary}
                </Link>
              ) : (
                <span className="text-neutral-800">{entry.summary}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
