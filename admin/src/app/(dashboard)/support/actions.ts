"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, SUPPORT_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications/provider";
import {
  TicketChannel,
  TicketStatus,
  TicketCategory,
  TicketMessageDirection,
  TicketMessageDeliveryState,
  NotificationType,
} from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const TICKET_CHANNELS = Object.values(TicketChannel) as string[];
const TICKET_CATEGORIES = Object.values(TicketCategory) as string[];

// --- SUP-01/02 create a ticket ----------------------------------------------
// Admin-initiated (a caller/emailer/whatsapper reaching support) as well as
// the landing point for an in-app "contact support" flow, if one is ever
// wired up client-side. SUP-02's technical-state snapshot is captured here,
// once, at open — attachedCountry/attachedPlan/attachedPaymentState are
// real fields sourced from the account's actual region/current subscription;
// device/build/errors are left out entirely (no telemetry table exists).

export async function createTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(SUPPORT_ROLES);
  const accountId = String(formData.get("accountId") || "").trim();
  const channel = String(formData.get("channel") || "");
  const subject = String(formData.get("subject") || "").trim();
  const initialMessage = String(formData.get("initialMessage") || "").trim();

  if (!accountId) return { error: "An account id is required." };
  if (!TICKET_CHANNELS.includes(channel)) return { error: "Pick a channel." };
  if (!subject) return { error: "A subject is required." };

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } } },
  });
  if (!account) return { error: "No account with that id." };

  const currentSubscription = account.subscriptions[0] ?? null;

  const ticket = await prisma.ticket.create({
    data: {
      accountId,
      channel: channel as TicketChannel,
      subject,
      status: TicketStatus.OPEN,
      attachedCountry: account.region,
      attachedPlan: currentSubscription?.plan.name ?? null,
      attachedPaymentState: currentSubscription?.status ?? null,
      messages: initialMessage
        ? {
            create: {
              direction: TicketMessageDirection.INBOUND,
              channel: channel as TicketChannel,
              body: initialMessage,
              deliveryState: TicketMessageDeliveryState.DELIVERED,
            },
          }
        : undefined,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.ticket_open",
      entityType: "Ticket",
      entityId: ticket.id,
      targetAccountId: accountId,
      afterData: { channel, subject },
    },
  );

  revalidatePath("/support");
  return { ok: true, message: `Ticket opened.` };
}

// --- SUP-05 log what came in on a non-in-app channel ------------------------
// There is no inbound webhook for email/SMS/WhatsApp/phone — an admin
// transcribes what the user said. Reopens a resolved/closed ticket back to
// OPEN, since new inbound contact means it's waiting again.

export async function logInboundMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(SUPPORT_ROLES);
  const ticketId = String(formData.get("ticketId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Message body is required." };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };

  await prisma.ticketMessage.create({
    data: {
      ticketId,
      direction: TicketMessageDirection.INBOUND,
      channel: ticket.channel,
      body,
      sentByAdminId: admin.adminId,
      deliveryState: TicketMessageDeliveryState.DELIVERED,
    },
  });

  if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED) {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.OPEN } });
  }

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.ticket_inbound_logged",
      entityType: "Ticket",
      entityId: ticketId,
      targetAccountId: ticket.accountId,
    },
  );

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: true, message: "Logged." };
}

// --- SUP-05 reply from the console on the ticket's channel ------------------
// IN_APP actually writes a real Notification row via notify() — that's real
// delivery. EMAIL/SMS/WHATSAPP/PHONE have no configured provider (see
// .env.example RESEND_API_KEY/AFRICASTALKING_*) so they're recorded as
// NO_PROVIDER — an honest no-op, never a faked send.

export async function replyToTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(SUPPORT_ROLES);
  const ticketId = String(formData.get("ticketId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "A message body is required." };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };

  let deliveryState: TicketMessageDeliveryState;
  let resultMessage: string;

  if (ticket.channel === TicketChannel.IN_APP) {
    await notify({
      accountId: ticket.accountId,
      type: NotificationType.GENERIC,
      title: `Re: ${ticket.subject}`,
      body,
      metadata: { ticketId: ticket.id },
    });
    deliveryState = TicketMessageDeliveryState.DELIVERED;
    resultMessage = "Sent as an in-app notification.";
  } else {
    deliveryState = TicketMessageDeliveryState.NO_PROVIDER;
    const providerNote =
      ticket.channel === TicketChannel.EMAIL
        ? "no RESEND_API_KEY configured"
        : ticket.channel === TicketChannel.SMS || ticket.channel === TicketChannel.WHATSAPP
          ? "no AFRICASTALKING_* credentials configured"
          : "phone replies aren't sendable from the console";
    resultMessage = `Recorded — not actually sent (${providerNote}). No live ${ticket.channel} provider is wired up yet.`;
  }

  await prisma.ticketMessage.create({
    data: {
      ticketId,
      direction: TicketMessageDirection.OUTBOUND,
      channel: ticket.channel,
      body,
      sentByAdminId: admin.adminId,
      deliveryState,
    },
  });

  const updateData: { firstRespondedAt?: Date; status?: TicketStatus } = {};
  if (!ticket.firstRespondedAt) updateData.firstRespondedAt = new Date();
  if (ticket.status === TicketStatus.OPEN) updateData.status = TicketStatus.PENDING;
  if (Object.keys(updateData).length > 0) {
    await prisma.ticket.update({ where: { id: ticketId }, data: updateData });
  }

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.ticket_reply",
      entityType: "Ticket",
      entityId: ticketId,
      targetAccountId: ticket.accountId,
      metadata: { channel: ticket.channel, deliveryState },
    },
  );

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: true, message: resultMessage };
}

// --- SUP-06 close with a fixed category + resolution note ------------------

export async function closeTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(SUPPORT_ROLES);
  const ticketId = String(formData.get("ticketId") || "");
  const category = String(formData.get("category") || "");
  const resolutionNote = String(formData.get("resolutionNote") || "").trim();

  if (!TICKET_CATEGORIES.includes(category)) return { error: "Pick a category from the list." };
  if (!resolutionNote) return { error: "A resolution note is required to close a ticket." };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };
  if (ticket.status === TicketStatus.CLOSED) return { error: "Already closed." };

  const now = new Date();
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: TicketStatus.CLOSED,
      category: category as TicketCategory,
      resolutionNote,
      resolvedAt: ticket.resolvedAt ?? now,
      closedAt: now,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.ticket_close",
      entityType: "Ticket",
      entityId: ticketId,
      targetAccountId: ticket.accountId,
      reason: resolutionNote,
      afterData: { category },
    },
  );

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: true, message: "Ticket closed." };
}

export async function reopenTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(SUPPORT_ROLES);
  const ticketId = String(formData.get("ticketId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to reopen a closed ticket." };

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: TicketStatus.OPEN, closedAt: null },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.ticket_reopen",
      entityType: "Ticket",
      entityId: ticketId,
      targetAccountId: ticket.accountId,
      reason,
    },
  );

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: true, message: "Ticket reopened." };
}

// --- Assignee — only meaningful once there's more than one Support/Owner admin ---

export async function assignTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(SUPPORT_ROLES);
  const ticketId = String(formData.get("ticketId") || "");
  const assignedAdminId = String(formData.get("assignedAdminId") || "").trim();

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };

  if (assignedAdminId) {
    const assignee = await prisma.adminUser.findUnique({ where: { id: assignedAdminId } });
    if (!assignee) return { error: "No such admin." };
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedAdminId: assignedAdminId || null },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "support.ticket_assign",
      entityType: "Ticket",
      entityId: ticketId,
      targetAccountId: ticket.accountId,
      afterData: { assignedAdminId: assignedAdminId || null },
    },
  );

  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
  return { ok: true, message: "Assignment updated." };
}
