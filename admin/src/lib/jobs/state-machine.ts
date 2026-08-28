import { JobStatus } from "@/generated/prisma/enums";

/**
 * Valid job status transitions. Keys are the "from" status; values are the
 * set of statuses that status may move to. Anything not listed is invalid
 * and must be rejected server-side — never trust an arbitrary status write.
 *
 * Lifecycle: INTAKE -> AWAITING_APPROVAL -> APPROVED -> IN_PROGRESS ->
 * READY_FOR_COLLECTION -> INVOICED -> PARTIALLY_PAID -> PAID, with
 * DECLINED/CANCELLED as alternate terminal states reachable from most
 * pre-collection steps.
 */
export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.INTAKE]: [JobStatus.AWAITING_APPROVAL, JobStatus.CANCELLED],
  [JobStatus.AWAITING_APPROVAL]: [
    JobStatus.APPROVED,
    JobStatus.DECLINED,
    JobStatus.CANCELLED,
  ],
  [JobStatus.APPROVED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
  [JobStatus.IN_PROGRESS]: [JobStatus.READY_FOR_COLLECTION, JobStatus.CANCELLED],
  [JobStatus.READY_FOR_COLLECTION]: [JobStatus.INVOICED],
  [JobStatus.INVOICED]: [JobStatus.PARTIALLY_PAID, JobStatus.PAID],
  [JobStatus.PARTIALLY_PAID]: [JobStatus.PAID],
  [JobStatus.PAID]: [],
  [JobStatus.DECLINED]: [],
  [JobStatus.CANCELLED]: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return false;
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidJobTransitionError extends Error {
  constructor(from: JobStatus, to: JobStatus) {
    super(`Cannot move a job from ${from} to ${to}.`);
    this.name = "InvalidJobTransitionError";
  }
}

/** Throws InvalidJobTransitionError if the transition isn't allowed. */
export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) {
    throw new InvalidJobTransitionError(from, to);
  }
}
