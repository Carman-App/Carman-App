"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, SYSTEM_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { BackgroundJobStatus } from "@/generated/prisma/enums";
import { runJobNow } from "@/lib/queue/handlers";
import { resolveAccountForJob } from "@/lib/system/jobs";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

/**
 * OPS-03 — "retry a failed job for one account... outcome reported back and
 * recorded against account." Runs the job's real handler inline (via
 * runJobNow, the same code scripts/queue-worker.ts's poller uses) rather
 * than just flipping status back to PENDING and hoping a poller picks it up
 * later — that way the admin who clicked "Retry" sees the real outcome
 * immediately, not just "queued again".
 */
export async function retryFailedJob(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(SYSTEM_ROLES);
  const jobId = String(formData.get("jobId") || "");

  const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
  if (!job) return { error: "Job not found." };
  if (job.status !== BackgroundJobStatus.FAILED) {
    return { error: `Job is ${job.status.toLowerCase()}, not failed — nothing to retry.` };
  }

  // A permanently-failed job already exhausted maxAttempts (that's what
  // FAILED means for this queue — see failJob in src/lib/queue/queue.ts). A
  // manual retry is a deliberate admin override of that automatic give-up
  // policy, so it gets one more attempt budget rather than being silently
  // re-claimed and immediately re-failed by the same exhausted-attempts check.
  if (job.attempts >= job.maxAttempts) {
    await prisma.backgroundJob.update({ where: { id: jobId }, data: { maxAttempts: job.attempts + 1 } });
  }

  const account = await resolveAccountForJob(job.type, job.payload);
  const outcome = await runJobNow({ id: job.id, type: job.type, payload: job.payload });

  await writeAdminAuditLog(admin, {
    action: "system.job_retry",
    entityType: "BackgroundJob",
    entityId: jobId,
    targetAccountId: account?.id ?? null,
    afterData: outcome.ok ? { ok: true, result: outcome.result } : { ok: false, error: outcome.error },
    metadata: { jobType: job.type, previousError: job.lastError },
  });

  revalidatePath("/system");

  return outcome.ok
    ? { ok: true, message: `Retried — succeeded. Result: ${JSON.stringify(outcome.result)}` }
    : { error: `Retried — failed again: ${outcome.error}` };
}
