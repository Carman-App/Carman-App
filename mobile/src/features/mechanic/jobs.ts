import type { Job, JobStatus } from '@/data/hooks';
import { Colors } from '@/theme/tokens';

export type JobGroup = 'waiting' | 'progress' | 'ready' | 'owed' | 'closed';

export const STATUS_META: Record<JobStatus, { label: string; group: JobGroup; color: string; tint: string }> = {
  INTAKE: { label: 'New', group: 'progress', color: Colors.slate, tint: Colors.chip },
  AWAITING_APPROVAL: { label: 'Waiting on the owner', group: 'waiting', color: Colors.cta, tint: Colors.ctaSoft },
  APPROVED: { label: 'Approved', group: 'progress', color: Colors.accent, tint: Colors.accentSoft },
  IN_PROGRESS: { label: 'In progress', group: 'progress', color: Colors.accent, tint: Colors.accentSoft },
  READY_FOR_COLLECTION: { label: 'Ready', group: 'ready', color: Colors.positive, tint: Colors.positiveSoft },
  INVOICED: { label: 'Invoiced', group: 'owed', color: Colors.orange, tint: Colors.warningSoft },
  PARTIALLY_PAID: { label: 'Part paid', group: 'owed', color: Colors.orange, tint: Colors.warningSoft },
  PAID: { label: 'Paid', group: 'closed', color: Colors.textMuted, tint: Colors.chip },
  DECLINED: { label: 'Declined', group: 'closed', color: Colors.signal, tint: Colors.signalSoft },
  CANCELLED: { label: 'Cancelled', group: 'closed', color: Colors.textMuted, tint: Colors.chip },
};

export const GROUP_LABEL: Record<JobGroup, string> = {
  waiting: 'Waiting on the owner',
  progress: 'In progress',
  ready: 'Ready to collect',
  owed: 'Invoiced, still owed',
  closed: 'Closed',
};

/** The next step a mechanic can take on a job, mirroring the server's state machine. */
export const NEXT_STEP: Partial<Record<JobStatus, { to: JobStatus; label: string }>> = {
  INTAKE: { to: 'AWAITING_APPROVAL', label: 'Send for approval' },
  APPROVED: { to: 'IN_PROGRESS', label: 'Start the work' },
  IN_PROGRESS: { to: 'READY_FOR_COLLECTION', label: 'Mark ready' },
  READY_FOR_COLLECTION: { to: 'INVOICED', label: 'Invoice the owner' },
  INVOICED: { to: 'PAID', label: 'Record payment' },
  PARTIALLY_PAID: { to: 'PAID', label: 'Record payment' },
};

export const jobTotal = (j: Job) => j.lines.reduce((s, l) => s + l.cost, 0);

/** "Job 0087": a stable, human number from the job's place in the workshop's history. */
export function jobNumber(job: Job, all: Job[]) {
  const sorted = [...all].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const i = sorted.findIndex((j) => j.id === job.id);
  return String((i < 0 ? 0 : i) + 1).padStart(4, '0');
}

export const isOpen = (j: Job) => STATUS_META[j.status].group !== 'closed';
