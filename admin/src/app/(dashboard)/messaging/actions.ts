"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { CampaignChannel, MessageClass, SuppressionReason } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { segmentDefinitionFromFormData } from "@/lib/messaging/segments";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// --- COMM-01 segment builder -------------------------------------------------

export async function createSegment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "A segment name is required." };

  const definition = segmentDefinitionFromFormData(formData);
  const segment = await prisma.segment.create({
    data: { name, definition: definition as Prisma.InputJsonValue, createdByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.segment_create",
    entityType: "Segment",
    entityId: segment.id,
    afterData: { name, definition },
  });

  revalidatePath("/messaging");
  return { ok: true, message: "Segment created." };
}

// --- COMM-01 campaign builder -------------------------------------------------

const CHANNELS = Object.values(CampaignChannel) as string[];
const CLASSES = Object.values(MessageClass) as string[];

export async function createCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const name = String(formData.get("name") || "").trim();
  const channel = String(formData.get("channel") || "");
  const messageClass = String(formData.get("messageClass") || "");
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const segmentId = String(formData.get("segmentId") || "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim();

  if (!name) return { error: "A campaign name is required." };
  if (!CHANNELS.includes(channel)) return { error: "Pick a channel." };
  if (!CLASSES.includes(messageClass)) return { error: "Pick a message class." };
  if (!body) return { error: "A message body is required." };

  let scheduledAt: Date | null = null;
  if (scheduledAtRaw) {
    const parsed = new Date(scheduledAtRaw);
    if (Number.isNaN(parsed.getTime())) return { error: "Invalid schedule date/time." };
    scheduledAt = parsed;
  }

  if (segmentId) {
    const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
    if (!segment) return { error: "Selected segment not found." };
  }

  const campaign = await prisma.campaign.create({
    data: {
      name,
      channel: channel as CampaignChannel,
      messageClass: messageClass as MessageClass,
      subject: subject || null,
      body,
      segmentId: segmentId || null,
      scheduledAt,
      createdByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.campaign_create",
    entityType: "Campaign",
    entityId: campaign.id,
    afterData: { name, channel, messageClass, segmentId: segmentId || null, scheduledAt },
  });

  revalidatePath("/messaging");
  redirect(`/messaging/campaigns/${campaign.id}`);
}

// --- COMM-03 admin-facing "add suppression" -----------------------------------
// There's no real end-user opt-out UI anywhere in this codebase, so
// USER_OPTED_OUT / BOUNCED reasons have no producer — this form only ever
// records ADMIN_SET, so the suppression mechanism (checked before every
// send in src/lib/messaging/suppression.ts) is exercisable/testable.

export async function addSuppression(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const accountId = String(formData.get("accountId") || "").trim();
  const channelRaw = String(formData.get("channel") || "");
  const messageClassRaw = String(formData.get("messageClass") || "");

  if (!accountId) return { error: "Missing account id." };
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "Account not found." };

  const channel = CHANNELS.includes(channelRaw) ? (channelRaw as CampaignChannel) : null;
  const messageClass = CLASSES.includes(messageClassRaw) ? (messageClassRaw as MessageClass) : null;

  const suppression = await prisma.messageSuppression.create({
    data: {
      accountId,
      channel,
      messageClass,
      reason: SuppressionReason.ADMIN_SET,
      createdByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.suppression_add",
    entityType: "MessageSuppression",
    entityId: suppression.id,
    targetAccountId: accountId,
    afterData: { channel, messageClass, reason: "ADMIN_SET" },
  });

  revalidatePath(`/accounts/${accountId}`);
  return { ok: true, message: "Suppression added." };
}
