"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { validateTemplateVariables } from "@/lib/messaging/templates";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const key = String(formData.get("key") || "").trim();
  const language = String(formData.get("language") || "en").trim() || "en";
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const variables = String(formData.get("variables") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!key) return { error: "Missing template key." };
  if (!body) return { error: "A body is required." };

  const undeclared = validateTemplateVariables(subject || null, body, variables);
  if (undeclared.length > 0) {
    return {
      error: `Subject/body reference {{${undeclared.join("}}, {{")}}} which ${undeclared.length === 1 ? "isn't" : "aren't"} in the declared variables list. Add ${undeclared.length === 1 ? "it" : "them"} to Variables, or remove the placeholder.`,
    };
  }

  const before = await prisma.notificationTemplate.findUnique({ where: { key_language: { key, language } } });

  const saved = await prisma.notificationTemplate.upsert({
    where: { key_language: { key, language } },
    create: { key, language, subject: subject || null, body, variables, updatedByAdminId: admin.adminId },
    update: { subject: subject || null, body, variables, updatedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.template_update",
    entityType: "NotificationTemplate",
    entityId: saved.id,
    beforeData: before ? { subject: before.subject, body: before.body, variables: before.variables } : null,
    afterData: { subject: saved.subject, body: saved.body, variables: saved.variables },
    metadata: {
      note: "No code path reads NotificationTemplate to send a real notification yet — this save has no effect on live sends.",
    },
  });

  revalidatePath(`/messaging/templates/${key}`);
  revalidatePath("/messaging/templates");
  return { ok: true, message: "Template saved." };
}
