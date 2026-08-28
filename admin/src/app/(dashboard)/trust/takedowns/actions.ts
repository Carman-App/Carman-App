"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, TRUST_DANGEROUS_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

// TRUST-05 — take down an uploaded image without destroying its record.
// fileKey is swapped for a stated placeholder; originalFileKey preserves
// what it was so the real object stays retrievable if ever needed. This
// deliberately never calls deleteFile from src/lib/storage.ts — the point
// is hiding, not destroying. Title/expiryDate/vehicleId are untouched.

// Not exported: a "use server" file may only export async functions. Inlined
// below wherever the placeholder key is needed.
const TAKEDOWN_PLACEHOLDER_KEY = "__TAKEDOWN_PLACEHOLDER__";

export async function takedownDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(TRUST_DANGEROUS_ROLES);
  const documentId = String(formData.get("documentId") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) return { error: "A reason is required to take down a document." };

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return { error: "Document not found." };
  if (document.takedownAt) return { error: "Already taken down." };

  const before = { fileKey: document.fileKey };
  const now = new Date();

  await prisma.document.update({
    where: { id: documentId },
    data: {
      originalFileKey: document.fileKey,
      fileKey: TAKEDOWN_PLACEHOLDER_KEY,
      takedownAt: now,
      takedownReason: reason,
      takedownByAdminId: admin.adminId,
    },
  });

  await writeAdminAuditLog(
    { adminId: admin.adminId },
    {
      action: "trust.document_takedown",
      entityType: "Document",
      entityId: documentId,
      reason,
      beforeData: before,
      afterData: { fileKey: TAKEDOWN_PLACEHOLDER_KEY },
    },
  );

  revalidatePath("/documents");
  revalidatePath(`/trust/takedowns/${documentId}`);
  return { ok: true, message: "Taken down. The original object key is preserved in originalFileKey, not deleted." };
}
