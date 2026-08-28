"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { BannerSeverity } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { segmentDefinitionFromFormData } from "@/lib/messaging/segments";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const SEVERITIES = Object.values(BannerSeverity) as string[];

export async function createBanner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const message = String(formData.get("message") || "").trim();
  const severity = String(formData.get("severity") || "");
  const expiresAtRaw = String(formData.get("expiresAt") || "").trim();
  const everyone = formData.get("everyone") === "on";

  if (!message) return { error: "A message is required." };
  if (!SEVERITIES.includes(severity)) return { error: "Pick a severity." };
  if (!expiresAtRaw) return { error: "An expiry date/time is required." };
  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime())) return { error: "Invalid expiry date/time." };
  if (expiresAt.getTime() <= Date.now()) return { error: "Expiry must be in the future." };

  const audience = everyone ? null : segmentDefinitionFromFormData(formData);

  const banner = await prisma.banner.create({
    data: {
      message,
      severity: severity as BannerSeverity,
      audience: (audience as Prisma.InputJsonValue | null) ?? undefined,
      expiresAt,
      createdByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.banner_create",
    entityType: "Banner",
    entityId: banner.id,
    afterData: { message, severity, audience, expiresAt },
  });

  revalidatePath("/messaging/banners");
  return { ok: true, message: "Banner created." };
}

export async function clearBanner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(MESSAGING_ROLES);
  const bannerId = String(formData.get("bannerId") || "");
  const banner = await prisma.banner.findUnique({ where: { id: bannerId } });
  if (!banner) return { error: "Banner not found." };
  if (banner.clearedAt) return { error: "Already cleared." };

  await prisma.banner.update({
    where: { id: bannerId },
    data: { clearedAt: new Date(), clearedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(admin, {
    action: "messaging.banner_clear",
    entityType: "Banner",
    entityId: bannerId,
  });

  revalidatePath("/messaging/banners");
  return { ok: true, message: "Cleared for every viewer." };
}
