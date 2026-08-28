"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, TRUST_DANGEROUS_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { DisclosureRequestType } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const REQUEST_TYPES = Object.values(DisclosureRequestType) as string[];

// TRUST-06 — documented path for a police/insurer/regulator request. A
// single OWNER-role admin records the whole thing as a compliance record;
// per AGENTS.md this is deliberately NOT a two-person-approval flow —
// `approvedByAdminId` is just the signed-in admin submitting it.

export async function createDisclosureRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_DANGEROUS_ROLES);

  const requesterName = String(formData.get("requesterName") || "").trim();
  const requesterOrg = String(formData.get("requesterOrg") || "").trim();
  const requestType = String(formData.get("requestType") || "");
  const legalAuthority = String(formData.get("legalAuthority") || "").trim();
  const whatWasDisclosed = String(formData.get("whatWasDisclosed") || "").trim();
  const relatedAccountId = String(formData.get("relatedAccountId") || "").trim();
  const relatedEntityType = String(formData.get("relatedEntityType") || "").trim();
  const relatedEntityId = String(formData.get("relatedEntityId") || "").trim();
  const userNotified = formData.get("userNotified") === "on";
  const receivedAtRaw = String(formData.get("receivedAt") || "");

  if (!requesterName) return { error: "Requester name is required." };
  if (!requesterOrg) return { error: "Requester organization is required." };
  if (!REQUEST_TYPES.includes(requestType)) return { error: "Pick a request type." };
  if (!legalAuthority) return { error: "Legal authority is required." };
  if (!whatWasDisclosed) return { error: "State what was disclosed (or will be)." };
  if (!receivedAtRaw) return { error: "The date the request was received is required." };

  const receivedAt = new Date(receivedAtRaw);
  if (Number.isNaN(receivedAt.getTime())) return { error: "Invalid received date." };

  if (relatedAccountId) {
    const account = await prisma.account.findUnique({ where: { id: relatedAccountId } });
    if (!account) return { error: "No account with that related-account id." };
  }

  const record = await prisma.disclosureRequest.create({
    data: {
      requesterName,
      requesterOrg,
      requestType: requestType as DisclosureRequestType,
      legalAuthority,
      whatWasDisclosed,
      relatedAccountId: relatedAccountId || null,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
      approvedByAdminId: admin.adminId,
      userNotified,
      userNotifiedAt: userNotified ? new Date() : null,
      receivedAt,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.disclosure_request_recorded",
      entityType: "DisclosureRequest",
      entityId: record.id,
      targetAccountId: relatedAccountId || null,
      reason: legalAuthority,
      afterData: { requestType, requesterOrg, userNotified },
    },
  );

  revalidatePath("/trust/disclosures");
  redirect("/trust/disclosures");
}
