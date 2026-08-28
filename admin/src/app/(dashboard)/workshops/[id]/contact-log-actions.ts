"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, WORK_CONTACT_LOG_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const CHANNELS = ["call", "message"] as const;

// WORK-08 — Workshop has no stored dialable phone number anywhere (not on
// Workshop, WorkshopMember, Account, or User — see prisma/schema.prisma,
// User has no phone field at all). So there is no real "call" link to wire
// up; this form is the entire feature — an admin logs that a call/message
// happened and its outcome, after making contact through whatever channel
// exists outside this system (the app's own messaging, a personal phone, etc).

export async function logWorkshopContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(WORK_CONTACT_LOG_ROLES);
  const workshopId = String(formData.get("workshopId") || "");
  const channel = String(formData.get("channel") || "");
  const outcomeNote = String(formData.get("outcomeNote") || "").trim();

  if (!CHANNELS.includes(channel as (typeof CHANNELS)[number])) {
    return { error: "Pick a channel (call or message)." };
  }
  if (!outcomeNote) return { error: "An outcome note is required." };

  const workshop = await prisma.workshop.findUnique({ where: { id: workshopId } });
  if (!workshop) return { error: "Workshop not found." };

  await prisma.workshopContactLog.create({
    data: {
      workshopId,
      accountId: workshop.ownerId,
      channel,
      outcomeNote,
      performedByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "workshop.contact_log",
      entityType: "Workshop",
      entityId: workshopId,
      metadata: { channel, outcomeNote },
    },
  );

  revalidatePath(`/workshops/${workshopId}`);
  return { ok: true, message: "Contact logged." };
}
