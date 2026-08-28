import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, MESSAGING_ROLES, MESSAGING_SEND_ROLES } from "@/lib/auth/rbac";
import { CampaignStatus } from "@/generated/prisma/enums";
import { resolveSegmentAccountIds, describeSegmentDefinition, type SegmentDefinition } from "@/lib/messaging/segments";
import { getSuppressionMap } from "@/lib/messaging/suppression";
import { getOverCapAccountIds } from "@/lib/messaging/frequency-cap";
import { GoLivePanel } from "./go-live-panel";
import { TestSendButton, CancelButton } from "./campaign-actions";

export const dynamic = "force-dynamic";

const LIVE_STATUSES: CampaignStatus[] = [CampaignStatus.DRAFT, CampaignStatus.TEST_SENT, CampaignStatus.SCHEDULED];

async function getAdminNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();
  const admins = await prisma.adminUser.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true, email: true } });
  return new Map(admins.map((a) => [a.id, `${a.name} (${a.email})`]));
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(MESSAGING_ROLES);
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      segment: true,
      recipients: {
        include: { account: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      },
    },
  });
  if (!campaign) notFound();

  const adminNames = await getAdminNames([campaign.createdByAdminId, campaign.testSentToAdminId]);
  const canSend = MESSAGING_SEND_ROLES.includes(session.role);
  const isLive = LIVE_STATUSES.includes(campaign.status);

  let liveCount = 0;
  let suppressedCount = 0;
  if (isLive) {
    const accountIds = await resolveSegmentAccountIds((campaign.segment?.definition as SegmentDefinition | undefined) ?? null);
    liveCount = accountIds.length;
    const [suppressionMap, overCapSet] = await Promise.all([
      getSuppressionMap(accountIds, campaign.channel, campaign.messageClass),
      getOverCapAccountIds(accountIds, campaign.messageClass),
    ]);
    const blocked = new Set<string>([...suppressionMap.keys(), ...overCapSet]);
    suppressedCount = blocked.size;
  }

  return (
    <div className="space-y-6">
      <Link href="/messaging" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Messaging
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{campaign.name}</h1>
      </div>

      <DetailView
        title="Campaign"
        fields={[
          { label: "Status", value: <Badge value={campaign.status} /> },
          { label: "Channel", value: <Badge value={campaign.channel} /> },
          { label: "Message class", value: <Badge value={campaign.messageClass} /> },
          {
            label: "Segment",
            value: campaign.segment
              ? `${campaign.segment.name} — ${describeSegmentDefinition(campaign.segment.definition as SegmentDefinition)}`
              : "Everyone (no segment)",
          },
          { label: "Subject", value: campaign.subject ?? "—" },
          { label: "Body", value: <pre className="whitespace-pre-wrap font-sans">{campaign.body}</pre> },
          { label: "Created by", value: adminNames.get(campaign.createdByAdminId) ?? campaign.createdByAdminId },
          { label: "Created", value: formatDateTime(campaign.createdAt) },
          {
            label: "Test send",
            value: campaign.testSentAt
              ? `Rendered preview ${formatDateTime(campaign.testSentAt)} by ${(campaign.testSentToAdminId && adminNames.get(campaign.testSentToAdminId)) ?? campaign.testSentToAdminId} — this was a rendered preview only, no device received it.`
              : "Not yet test-sent — required before this can be scheduled or sent.",
          },
          { label: "Scheduled for", value: campaign.scheduledAt ? formatDateTime(campaign.scheduledAt) : "—" },
          { label: "Sent", value: campaign.sentAt ? formatDateTime(campaign.sentAt) : "—" },
          { label: "Recipient count at send", value: campaign.recipientCountAtSend ?? "—" },
          { label: "Suppressed count at send", value: campaign.suppressedCountAtSend ?? "—" },
        ]}
      />

      {isLive && (
        <Section title="Go live">
          {canSend ? (
            <div className="space-y-3">
              {!campaign.testSentAt && (
                <p className="text-sm text-amber-700">
                  A test send is required before this campaign can be scheduled or sent — the buttons
                  below will reject the attempt server-side until one is recorded.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <TestSendButton campaignId={campaign.id} />
                <CancelButton campaignId={campaign.id} />
              </div>
              {campaign.testSentAt && (
                <GoLivePanel
                  campaignId={campaign.id}
                  channel={campaign.channel}
                  liveCount={liveCount}
                  suppressedCount={suppressedCount}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Only OWNER-role admins can test-send, schedule, or send a campaign live.
            </p>
          )}
        </Section>
      )}

      <Section title="Recipients (most recent 200)">
        <DataTable
          rows={campaign.recipients}
          emptyLabel="No recipients materialized yet — this campaign hasn't been sent."
          columns={[
            { header: "Account", cell: (r) => r.account.user.name },
            { header: "Email", cell: (r) => r.account.user.email },
            { header: "Channel", cell: (r) => <Badge value={r.channel} /> },
            { header: "Delivery state", cell: (r) => <Badge value={r.deliveryState} /> },
            { header: "Reason", cell: (r) => r.suppressedReason ?? "—" },
            { header: "Sent", cell: (r) => (r.sentAt ? formatDateTime(r.sentAt) : "—") },
          ]}
        />
      </Section>
    </div>
  );
}
