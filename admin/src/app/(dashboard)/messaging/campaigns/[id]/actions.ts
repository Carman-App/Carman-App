"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES, MESSAGING_SEND_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications/provider";
import { NotificationType, CampaignStatus, CampaignRecipientState, CampaignChannel } from "@/generated/prisma/enums";
import type { SegmentDefinition } from "@/lib/messaging/segments";
import { resolveSegmentAccountIds } from "@/lib/messaging/segments";
import { getSuppressionMap } from "@/lib/messaging/suppression";
import { getOverCapAccountIds } from "@/lib/messaging/frequency-cap";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const LIVE_STATUSES: CampaignStatus[] = [CampaignStatus.DRAFT, CampaignStatus.TEST_SENT, CampaignStatus.SCHEDULED];

// --- COMM-01 required test send ---------------------------------------------
// No AdminUser <-> Account link exists anywhere in this schema (AdminUser is
// a wholly separate table from Account/User — see prisma/schema.prisma's
// "Internal admin auth" section), so there is no real device/inbox of the
// signed-in admin's own to deliver a test message to. Rather than fabricate
// one, this renders the exact subject/body that would be sent and marks
// testSentAt/testSentToAdminId honestly as a dry-run preview, not a real
// delivery.
export async function testSendCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const campaignId = String(formData.get("campaignId") || "");
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { error: "Campaign not found." };
  if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.TEST_SENT) {
    return { error: `Can't test-send a campaign that is already ${campaign.status}.` };
  }

  const now = new Date();
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      testSentAt: now,
      testSentToAdminId: admin.adminId,
      status: campaign.status === CampaignStatus.DRAFT ? CampaignStatus.TEST_SENT : campaign.status,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.campaign_test_send",
    entityType: "Campaign",
    entityId: campaignId,
    metadata: { note: "Dry-run preview only — no AdminUser<->Account link exists to deliver a real test message to." },
  });

  revalidatePath(`/messaging/campaigns/${campaignId}`);
  return { ok: true, message: "Test send recorded — this rendered a preview, it did not deliver to any device." };
}

// --- COMM-01 schedule / send-now (OWNER-only, requires a prior test send) --

async function assertReadyToGoLive(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found.");
  if (!LIVE_STATUSES.includes(campaign.status)) {
    throw new Error(`Can't take a ${campaign.status} campaign live.`);
  }
  if (!campaign.testSentAt) {
    throw new Error("A test send is required before this campaign can be scheduled or sent.");
  }
  return campaign;
}

export async function scheduleCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_SEND_ROLES);
  const campaignId = String(formData.get("campaignId") || "");
  const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim();
  if (!scheduledAtRaw) return { error: "Pick a date/time to schedule for." };
  const scheduledAt = new Date(scheduledAtRaw);
  if (Number.isNaN(scheduledAt.getTime())) return { error: "Invalid date/time." };

  try {
    await assertReadyToGoLive(campaignId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not schedule this campaign." };
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { scheduledAt, status: CampaignStatus.SCHEDULED },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.campaign_schedule",
    entityType: "Campaign",
    entityId: campaignId,
    afterData: { scheduledAt },
    metadata: {
      note: "No background scheduler exists in this codebase — this only records intent. Someone still has to come back and click Send now at/after this time.",
    },
  });

  revalidatePath(`/messaging/campaigns/${campaignId}`);
  return { ok: true, message: `Scheduled for ${scheduledAt.toISOString()} — remember, nothing fires this automatically.` };
}

/**
 * The real COMM-01/02/03 send path. Materializes one CampaignRecipient row
 * per matched account: suppressed or over-cap accounts get a SUPPRESSED row
 * (never contacted); IN_APP gets a real notify() call (SENT); every other
 * channel gets NO_PROVIDER (honest no-op — no email/SMS/push provider is
 * wired up, see .env.example's RESEND_API_KEY, AFRICASTALKING_ vars, and
 * EXPO_ACCESS_TOKEN).
 */
export async function sendCampaignNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_SEND_ROLES);
  const campaignId = String(formData.get("campaignId") || "");

  let campaign;
  try {
    campaign = await assertReadyToGoLive(campaignId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send this campaign." };
  }

  const segment = campaign.segmentId ? await prisma.segment.findUnique({ where: { id: campaign.segmentId } }) : null;
  const accountIds = await resolveSegmentAccountIds((segment?.definition as SegmentDefinition | undefined) ?? null);

  const [suppressionMap, overCapSet] = await Promise.all([
    getSuppressionMap(accountIds, campaign.channel, campaign.messageClass),
    getOverCapAccountIds(accountIds, campaign.messageClass),
  ]);

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.SENDING } });

  let sentCount = 0;
  let suppressedCount = 0;

  for (const accountId of accountIds) {
    const suppressionReason = suppressionMap.get(accountId);
    const overCap = overCapSet.has(accountId);

    if (suppressionReason || overCap) {
      suppressedCount++;
      await prisma.campaignRecipient.create({
        data: {
          campaignId,
          accountId,
          channel: campaign.channel,
          deliveryState: CampaignRecipientState.SUPPRESSED,
          suppressedReason: suppressionReason ?? "Frequency cap",
        },
      });
      continue;
    }

    if (campaign.channel === CampaignChannel.IN_APP) {
      await notify({
        accountId,
        type: NotificationType.GENERIC,
        title: campaign.subject || campaign.name,
        body: campaign.body,
        metadata: { campaignId },
      });
      sentCount++;
      await prisma.campaignRecipient.create({
        data: {
          campaignId,
          accountId,
          channel: campaign.channel,
          deliveryState: CampaignRecipientState.SENT,
          sentAt: new Date(),
        },
      });
    } else {
      // No email/SMS/push provider is wired up — honest no-op, not a fake send.
      await prisma.campaignRecipient.create({
        data: {
          campaignId,
          accountId,
          channel: campaign.channel,
          deliveryState: CampaignRecipientState.NO_PROVIDER,
        },
      });
    }
  }

  const now = new Date();
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.SENT,
      sentAt: now,
      recipientCountAtSend: accountIds.length,
      suppressedCountAtSend: suppressedCount,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.campaign_send",
    entityType: "Campaign",
    entityId: campaignId,
    afterData: {
      recipientCountAtSend: accountIds.length,
      suppressedCountAtSend: suppressedCount,
      sentCount,
      channel: campaign.channel,
    },
  });

  revalidatePath(`/messaging/campaigns/${campaignId}`);
  revalidatePath("/messaging");
  return {
    ok: true,
    message:
      campaign.channel === CampaignChannel.IN_APP
        ? `Sent to ${sentCount} accounts (${suppressedCount} suppressed).`
        : `Recorded ${accountIds.length - suppressedCount} recipients as NO_PROVIDER (no ${campaign.channel} provider is configured) and ${suppressedCount} as suppressed.`,
  };
}

export async function cancelCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const campaignId = String(formData.get("campaignId") || "");
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { error: "Campaign not found." };
  if (!LIVE_STATUSES.includes(campaign.status)) {
    return { error: `Can't cancel a campaign that is already ${campaign.status}.` };
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: CampaignStatus.CANCELLED } });

  await writeAdminAuditLog(admin, {
    action: "messaging.campaign_cancel",
    entityType: "Campaign",
    entityId: campaignId,
  });

  revalidatePath(`/messaging/campaigns/${campaignId}`);
  revalidatePath("/messaging");
  return { ok: true, message: "Campaign cancelled." };
}
