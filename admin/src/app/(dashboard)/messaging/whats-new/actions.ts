"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

export async function createWhatsNewNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const version = String(formData.get("version") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const publishNow = formData.get("publishNow") === "on";

  if (!version) return { error: "A version is required." };
  if (!title) return { error: "A title is required." };
  if (!body) return { error: "A body is required." };

  const note = await prisma.whatsNewNote.create({
    data: {
      version,
      title,
      body,
      publishedAt: publishNow ? new Date() : null,
      createdByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.whats_new_create",
    entityType: "WhatsNewNote",
    entityId: note.id,
    afterData: { version, title, published: publishNow },
  });

  revalidatePath("/messaging/whats-new");
  return { ok: true, message: publishNow ? "Published." : "Saved as draft." };
}

export async function publishWhatsNewNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const noteId = String(formData.get("noteId") || "");
  const note = await prisma.whatsNewNote.findUnique({ where: { id: noteId } });
  if (!note) return { error: "Note not found." };
  if (note.publishedAt) return { error: "Already published." };

  await prisma.whatsNewNote.update({ where: { id: noteId }, data: { publishedAt: new Date() } });

  await writeAdminAuditLog(admin, {
    action: "messaging.whats_new_publish",
    entityType: "WhatsNewNote",
    entityId: noteId,
    metadata: {
      note: "No mobile client reads WhatsNewNote/WhatsNewView yet — 'shown once per account' is enforced nowhere today; this is a note-to-self for whoever wires up the mobile check-then-create-a-WhatsNewView flow.",
    },
  });

  revalidatePath("/messaging/whats-new");
  return { ok: true, message: "Published." };
}
