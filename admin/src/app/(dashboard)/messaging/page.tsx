import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { MessagingTabs } from "./messaging-tabs";
import { SegmentForm } from "./segment-form";
import { CampaignForm } from "./campaign-form";
import { countSegment, describeSegmentDefinition, type SegmentDefinition } from "@/lib/messaging/segments";

export const dynamic = "force-dynamic";

export default async function MessagingPage() {
  await requireRole(MESSAGING_ROLES);

  const [campaigns, segments] = await Promise.all([
    prisma.campaign.findMany({
      include: { segment: true, _count: { select: { recipients: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.segment.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const segmentsWithCounts = await Promise.all(
    segments.map(async (s) => ({
      id: s.id,
      name: s.name,
      definition: s.definition as SegmentDefinition,
      count: await countSegment(s.definition as SegmentDefinition),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Messaging</h1>
        <p className="text-sm text-neutral-500">
          Segments, campaigns, templates, what&rsquo;s-new notes and banners (COMM-01..06). Actual
          delivery for EMAIL/SMS/PUSH stays a logged no-op until real provider credentials exist (see
          RESEND_API_KEY / AFRICASTALKING_* / EXPO_ACCESS_TOKEN in .env.example) — only IN_APP
          campaigns actually deliver, via the existing Notification feed.
        </p>
      </div>

      <MessagingTabs active="campaigns" />

      <Section title="Segments">
        <DataTable
          rows={segmentsWithCounts}
          emptyLabel="No segments yet."
          columns={[
            { header: "Name", cell: (r) => r.name },
            { header: "Definition", cell: (r) => describeSegmentDefinition(r.definition) },
            { header: "Live count", cell: (r) => r.count },
          ]}
        />
        <SegmentForm />
      </Section>

      <Section title="Campaigns">
        <DataTable
          rows={campaigns}
          href={(r) => `/messaging/campaigns/${r.id}`}
          emptyLabel="No campaigns yet."
          columns={[
            { header: "Name", cell: (r) => r.name },
            { header: "Channel", cell: (r) => <Badge value={r.channel} /> },
            { header: "Class", cell: (r) => <Badge value={r.messageClass} /> },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Segment", cell: (r) => r.segment?.name ?? "Everyone" },
            { header: "Recipients", cell: (r) => r._count.recipients },
            { header: "Test sent", cell: (r) => (r.testSentAt ? formatDateTime(r.testSentAt) : "—") },
            { header: "Sent", cell: (r) => (r.sentAt ? formatDateTime(r.sentAt) : "—") },
            { header: "Created", cell: (r) => formatDateTime(r.createdAt) },
          ]}
        />
        <CampaignForm segments={segmentsWithCounts.map((s) => ({ id: s.id, name: s.name, count: s.count }))} />
      </Section>
    </div>
  );
}
