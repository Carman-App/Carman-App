/**
 * Client for the server-side assistant (`POST /api/v1/assistant`, Claude).
 * The Anthropic key lives on the server only. When the server has no key,
 * the network is down, or the call fails, callers fall back to the
 * on-device engine (`./engine.ts`) so Home still answers.
 */
import { fetch as streamingFetch } from 'expo/fetch';

import { ApiError, NetworkError, api, apiHeaders, apiUrl } from '@/data/api/client';
import type { Answer, Draft } from '@/features/assistant/engine';

type RemoteDraft = {
  kind: Draft['kind'];
  vehicleId: string | null;
  amount: number | null;
  litres: number | null;
  odometer: number | null;
  place: string | null;
  category: Draft['category'] | null;
  title: string | null;
  date: string | null;
};

type RemoteReply = {
  lead: string;
  body: string | null;
  checked: string | null;
  draft: RemoteDraft | null;
  link: { label: string; target: 'insights' | 'documents' | 'reminders' | 'garage' | 'timeline' | 'job_board' | 'job'; id: string | null } | null;
  jobIds: string[];
  lines?: JobLineDraft[];
};

/** An estimate line Claude drafted from the mechanic's dictation. */
export type JobLineDraft = {
  kind: 'PART' | 'LABOUR' | 'SERVICE' | 'FLUID';
  description: string;
  cost: number;
  priceSource: 'said' | 'history' | 'missing';
};

export type RemoteAnswer = Answer & {
  jobIds: string[];
  lines: JobLineDraft[];
  /** Draft fields Claude filled that the Review screen also needs. */
  draftExtras?: { vehicleId?: string; title?: string; date?: string };
  source: 'claude';
};

export type Turn = { question: string; answer: string };

function hrefFor(link: NonNullable<RemoteReply['link']>): string | null {
  switch (link.target) {
    case 'insights':
      return '/insights';
    case 'documents':
      return '/documents';
    case 'reminders':
      return '/reminders';
    case 'garage':
      return '/garage';
    case 'timeline':
      return link.id ? `/vehicle/${link.id}/timeline` : null;
    case 'job_board':
      return '/mechanic/job-board';
    case 'job':
      return link.id ? `/mechanic/job-detail?id=${link.id}` : '/mechanic/job-board';
  }
}

function toAnswer(r: RemoteReply): RemoteAnswer {
  const from = 'Read by Carma from what you said';
  let draft: Draft | undefined;
  if (r.draft) {
    const d = r.draft;
    draft = {
      kind: d.kind,
      amount: d.amount ?? undefined,
      litres: d.litres ?? undefined,
      odometer: d.odometer ?? undefined,
      place: d.place ?? undefined,
      category: d.category ?? (d.kind === 'fuel' ? 'fuel' : d.kind === 'service' ? 'service' : 'other'),
      sources: {
        kind: from,
        ...(d.amount != null ? { amount: from } : {}),
        ...(d.litres != null ? { litres: from } : {}),
        ...(d.odometer != null ? { odometer: from } : {}),
        ...(d.place ? { place: from } : {}),
        ...(d.vehicleId ? { vehicle: 'Carma matched it from what you said' } : {}),
      },
    };
  }
  const href = r.link ? hrefFor(r.link) : null;
  return {
    lead: r.lead,
    body: r.body ?? undefined,
    checked: r.checked ?? undefined,
    draft,
    link: r.link && href ? { label: r.link.label, href } : undefined,
    jobIds: r.jobIds,
    lines: r.lines ?? [],
    draftExtras: r.draft
      ? { vehicleId: r.draft.vehicleId ?? undefined, title: r.draft.title ?? undefined, date: r.draft.date ?? undefined }
      : undefined,
    source: 'claude',
  };
}

export type AskInput =
  | { mode: 'owner'; question: string; garageId: string; vehicleId?: string; history: Turn[] }
  | { mode: 'mechanic'; question: string; workshopId: string; jobId?: string; history: Turn[] };

/** Why a remote answer wasn't available, so the UI can say so once. */
export type FallbackReason = 'not-configured' | 'offline' | 'busy' | 'error' | 'refused';

export async function askRemote(input: AskInput): Promise<AskResult> {
  try {
    const reply = await api.post<RemoteReply>('assistant', input);
    return { ok: true, answer: toAnswer(reply) };
  } catch (e) {
    if (e instanceof NetworkError) return { ok: false, reason: 'offline' };
    if (e instanceof ApiError) {
      if (e.code === 'AI_NOT_CONFIGURED') return { ok: false, reason: 'not-configured' };
      if (e.code === 'AI_REFUSED') return { ok: false, reason: 'refused', message: e.message };
      if (e.code === 'AI_BUSY' || e.code === 'RATE_LIMITED') return { ok: false, reason: 'busy', message: e.message };
    }
    return { ok: false, reason: 'error' };
  }
}

type AskResult = { ok: true; answer: RemoteAnswer } | { ok: false; reason: FallbackReason; message?: string; partial?: boolean };

function reasonFor(code: string | undefined): FallbackReason {
  if (code === 'AI_NOT_CONFIGURED') return 'not-configured';
  if (code === 'AI_REFUSED') return 'refused';
  if (code === 'AI_BUSY' || code === 'RATE_LIMITED') return 'busy';
  return 'error';
}

/**
 * Streamed variant of askRemote: POST /api/v1/assistant/stream returns
 * newline-delimited JSON. `onPartial` receives the answer text so far as
 * Claude writes it; the promise resolves with the complete, validated reply.
 */
export async function askRemoteStream(input: AskInput, onPartial: (p: { lead: string; body: string }) => void): Promise<AskResult> {
  let res: Response;
  try {
    res = (await streamingFetch(apiUrl('assistant/stream'), {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(input),
    })) as unknown as Response;
  } catch {
    return { ok: false, reason: 'offline' };
  }

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    return { ok: false, reason: reasonFor(body?.error?.code), message: body?.error?.message };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawText = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        const event = JSON.parse(line) as
          | { type: 'text'; lead: string; body: string }
          | { type: 'done'; data: RemoteReply }
          | { type: 'error'; code: string; message: string };
        if (event.type === 'text') {
          sawText = true;
          onPartial({ lead: event.lead, body: event.body });
        } else if (event.type === 'done') {
          return { ok: true, answer: toAnswer(event.data) };
        } else {
          return { ok: false, reason: reasonFor(event.code), message: event.message, partial: sawText };
        }
      }
      if (done) break;
    }
  } catch {
    return { ok: false, reason: 'offline', partial: sawText };
  }
  return { ok: false, reason: 'error', partial: sawText };
}

/** One-line note shown under an answer that came from the on-device engine instead. */
export function fallbackNote(reason: FallbackReason): string | null {
  switch (reason) {
    case 'offline':
      return 'Offline: answered on this phone from what is already loaded.';
    case 'busy':
      return 'Carma is busy: answered on this phone instead.';
    case 'error':
      return 'Carma could not be reached: answered on this phone instead.';
    case 'not-configured':
    case 'refused':
      return null;
  }
}

export function turnText(a: Pick<Answer, 'lead' | 'body'>): string {
  return [a.lead, a.body].filter(Boolean).join(' ');
}
