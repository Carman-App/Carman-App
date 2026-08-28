"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { VehicleModelSubmissionStatus } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

async function loadPending(submissionId: string) {
  const submission = await prisma.userSubmittedVehicleModel.findUnique({ where: { id: submissionId } });
  if (!submission) return { error: "Submission not found." } as const;
  if (submission.status !== VehicleModelSubmissionStatus.PENDING) {
    return { error: `Already ${submission.status.toLowerCase()}.` } as const;
  }
  return { submission } as const;
}

export async function approveSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const submissionId = String(formData.get("submissionId") || "");
  const reviewNote = String(formData.get("reviewNote") || "").trim() || null;

  const loaded = await loadPending(submissionId);
  if ("error" in loaded) return { error: loaded.error };

  await prisma.userSubmittedVehicleModel.update({
    where: { id: submissionId },
    data: {
      status: VehicleModelSubmissionStatus.APPROVED,
      reviewNote,
      reviewedByAdminId: admin.adminId,
      reviewedAt: new Date(),
    },
  });

  await writeAdminAuditLog(admin, {
    action: "config.vehicle_model_approve",
    entityType: "UserSubmittedVehicleModel",
    entityId: submissionId,
    reason: reviewNote,
    afterData: { make: loaded.submission.make, model: loaded.submission.model },
    metadata: {
      note:
        "Approving marks the submission reviewed. There is no live make/model catalogue table this writes into " +
        "— the mobile app's picker still only reads its hardcoded mobile/src/data/vehicleCatalog.ts. Approving " +
        "does not add this make/model to any picker yet.",
    },
  });

  revalidatePath("/config/vehicle-models");
  return { ok: true, message: "Approved." };
}

export async function rejectSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const submissionId = String(formData.get("submissionId") || "");
  const reviewNote = String(formData.get("reviewNote") || "").trim();
  if (!reviewNote) return { error: "A reason is required to reject." };

  const loaded = await loadPending(submissionId);
  if ("error" in loaded) return { error: loaded.error };

  await prisma.userSubmittedVehicleModel.update({
    where: { id: submissionId },
    data: {
      status: VehicleModelSubmissionStatus.REJECTED,
      reviewNote,
      reviewedByAdminId: admin.adminId,
      reviewedAt: new Date(),
    },
  });

  await writeAdminAuditLog(admin, {
    action: "config.vehicle_model_reject",
    entityType: "UserSubmittedVehicleModel",
    entityId: submissionId,
    reason: reviewNote,
    afterData: { make: loaded.submission.make, model: loaded.submission.model },
  });

  revalidatePath("/config/vehicle-models");
  return { ok: true, message: "Rejected." };
}

export async function mergeSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const submissionId = String(formData.get("submissionId") || "");
  const mergedIntoMake = String(formData.get("mergedIntoMake") || "").trim();
  const mergedIntoModel = String(formData.get("mergedIntoModel") || "").trim();
  const reviewNote = String(formData.get("reviewNote") || "").trim() || null;

  if (!mergedIntoMake || !mergedIntoModel) {
    return { error: "Both the target make and model are required to merge." };
  }

  const loaded = await loadPending(submissionId);
  if ("error" in loaded) return { error: loaded.error };

  await prisma.userSubmittedVehicleModel.update({
    where: { id: submissionId },
    data: {
      status: VehicleModelSubmissionStatus.MERGED,
      mergedIntoMake,
      mergedIntoModel,
      reviewNote,
      reviewedByAdminId: admin.adminId,
      reviewedAt: new Date(),
    },
  });

  await writeAdminAuditLog(admin, {
    action: "config.vehicle_model_merge",
    entityType: "UserSubmittedVehicleModel",
    entityId: submissionId,
    reason: reviewNote,
    afterData: {
      submittedMake: loaded.submission.make,
      submittedModel: loaded.submission.model,
      mergedIntoMake,
      mergedIntoModel,
    },
    metadata: {
      note:
        "This records the merge decision only — it does not edit mobile/src/data/vehicleCatalog.ts, which is the " +
        "actual source the mobile picker reads.",
    },
  });

  revalidatePath("/config/vehicle-models");
  return { ok: true, message: "Merged." };
}
