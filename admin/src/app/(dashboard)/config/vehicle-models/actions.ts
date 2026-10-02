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

  // CFG-04 — "merge into existing... correcting the affected vehicles": a
  // merge means the make/model as originally entered was wrong/a duplicate
  // spelling, so every Vehicle row that was saved with that exact (type,
  // make, model) needs to be corrected to the canonical target — otherwise
  // the vehicles a submission came from stay stuck showing the uncorrected
  // value forever, and the merge decision above is purely cosmetic. There is
  // no submission -> vehicle FK in the schema (submissions don't record which
  // vehicle they came from), so the match is on the same (type, make, model)
  // triple the submission itself was keyed by — the only correlation this
  // schema can support.
  const correction = await prisma.vehicle.updateMany({
    where: { type: loaded.submission.vehicleType, make: loaded.submission.make, model: loaded.submission.model },
    data: { make: mergedIntoMake, model: mergedIntoModel },
  });

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
      vehiclesCorrected: correction.count,
    },
    metadata: {
      note:
        `Corrected ${correction.count} vehicle(s) with (type=${loaded.submission.vehicleType}, make="${loaded.submission.make}", model="${loaded.submission.model}") ` +
        `to (make="${mergedIntoMake}", model="${mergedIntoModel}"). This does not edit mobile/src/data/vehicleCatalog.ts, which is the ` +
        "actual source the mobile picker reads — that stays a manual code change either way.",
    },
  });

  revalidatePath("/config/vehicle-models");
  return {
    ok: true,
    message:
      correction.count > 0
        ? `Merged. ${correction.count} vehicle(s) corrected to "${mergedIntoMake} ${mergedIntoModel}".`
        : "Merged. No existing vehicles had this exact make/model to correct.",
  };
}
