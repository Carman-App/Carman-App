import type { Job } from '@/data/hooks';
import { STATUS_META, jobNumber, jobTotal } from '@/features/mechanic/jobs';
import { formatDateLong, formatNumber } from '@/lib/format';

export type MechAnswer = { lead: string; body?: string; checked?: string; jobIds?: string[] };

const STOP = new Set(['what', 'did', 'we', 'charge', 'for', 'the', 'last', 'time', 'a', 'an', 'on', 'how', 'much', 'was']);

/** Answers workshop questions from the job board's own data. */
export function answerMechanic(question: string, jobs: Job[], currency: string): MechAnswer {
  const q = question.toLowerCase();
  const money = (n: number) => `${currency} ${formatNumber(n)}`;
  const checked = `Checked ${jobs.length} job${jobs.length === 1 ? '' : 's'}`;

  if (/unpaid|owed|owing|invoice/.test(q)) {
    const owed = jobs.filter((j) => j.status === 'INVOICED' || j.status === 'PARTIALLY_PAID');
    const total = owed.reduce((s, j) => s + jobTotal(j), 0);
    return {
      lead: owed.length ? `${money(total)} is still owed on ${owed.length} invoice${owed.length === 1 ? '' : 's'}.` : 'Nothing is owed. Every invoiced job is paid.',
      body: owed.map((j) => `${j.customer?.name ?? 'Customer'} · Job ${jobNumber(j, jobs)} · ${money(jobTotal(j))}`).join('\n') || undefined,
      checked,
      jobIds: owed.map((j) => j.id),
    };
  }

  if (/waiting|parts|approval/.test(q)) {
    const waiting = jobs.filter((j) => j.status === 'AWAITING_APPROVAL' || j.status === 'APPROVED');
    return {
      lead: waiting.length ? `${waiting.length} job${waiting.length === 1 ? ' is' : 's are'} waiting to start.` : 'Nothing is waiting. Every open job is moving.',
      body: waiting.map((j) => `${j.customer?.name ?? 'Customer'} · ${STATUS_META[j.status].label.toLowerCase()}`).join('\n') || undefined,
      checked,
      jobIds: waiting.map((j) => j.id),
    };
  }

  if (/turnaround|how long|days/.test(q)) {
    const now = new Date();
    const done = jobs.filter((j) => ['READY_FOR_COLLECTION', 'INVOICED', 'PARTIALLY_PAID', 'PAID'].includes(j.status) && new Date(j.updatedAt).getMonth() === now.getMonth());
    if (!done.length) return { lead: 'No job has been finished this month yet.', checked };
    const days = done.reduce((s, j) => s + (new Date(j.updatedAt).getTime() - new Date(j.createdAt).getTime()) / 86_400_000, 0) / done.length;
    return { lead: `${days.toFixed(1)} days on average from intake to ready this month.`, body: `${done.length} job${done.length === 1 ? '' : 's'} finished.`, checked };
  }

  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (words.length) {
    const hits = jobs
      .flatMap((j) => j.lines.map((l) => ({ j, l })))
      .filter(({ l, j }) => words.some((w) => l.description.toLowerCase().includes(w) || (j.vehicleDescription ?? '').toLowerCase().includes(w)))
      .sort((a, b) => (a.l.createdAt < b.l.createdAt ? 1 : -1));
    if (hits.length) {
      const last = hits[0];
      return {
        lead: `${money(last.l.cost)} for ${last.l.description.toLowerCase()}, on ${formatDateLong(last.l.createdAt.slice(0, 10))}.`,
        body: `${last.j.customer?.name ?? 'Customer'} · ${last.j.vehicleDescription ?? 'vehicle'} · Job ${jobNumber(last.j, jobs)}. ${hits.length > 1 ? `${hits.length} matching lines in total.` : ''}`,
        checked,
        jobIds: [last.j.id],
      };
    }
  }

  const open = jobs.filter((j) => STATUS_META[j.status].group !== 'closed');
  return {
    lead: `${open.length} open job${open.length === 1 ? '' : 's'} on the board.`,
    body: 'Ask what you charged for a part, which jobs are waiting, what is still owed, or how long jobs are taking.',
    checked,
  };
}

export const MECH_SUGGESTIONS = ['What did we charge for front pads last time', 'Which jobs are waiting on parts', 'Unpaid invoices', 'Turnaround this month'];
