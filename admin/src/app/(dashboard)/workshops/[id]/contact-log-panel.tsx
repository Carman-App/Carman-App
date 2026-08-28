"use client";

import { useActionState } from "react";
import { logWorkshopContact, type ActionState } from "./contact-log-actions";
import { formatDateTime, titleCase } from "@/lib/format";

export type ContactLogRow = {
  id: string;
  channel: string;
  outcomeNote: string;
  performedByAdminId: string;
  occurredAt: Date;
};

export function ContactLogPanel({ workshopId, history }: { workshopId: string; history: ContactLogRow[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(logWorkshopContact, undefined);

  return (
    <div className="space-y-4">
      <p className="rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
        No dialable phone number is stored anywhere in this schema for a workshop, its staff, or its
        owner&rsquo;s account — there is no real &ldquo;call&rdquo; link to click. This form is the
        whole feature: log that contact happened (by whatever channel actually reached them) and its
        outcome.
      </p>
      <form action={formAction} className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
        <input type="hidden" name="workshopId" value={workshopId} />
        <div>
          <label className="block text-xs text-neutral-500">Channel</label>
          <select
            name="channel"
            required
            defaultValue=""
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="" disabled>
              Pick a channel…
            </option>
            <option value="call">Call</option>
            <option value="message">Message</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Outcome (required)</label>
          <textarea
            name="outcomeNote"
            required
            rows={2}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            placeholder="What happened, what was agreed, next step…"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Logging…" : "Log contact"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && state.message && <p className="text-sm text-emerald-600">{state.message}</p>}
      </form>

      {history.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
          No contact logged yet.
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <div key={entry.id} className="rounded border border-neutral-200 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-700">{titleCase(entry.channel)}</span>
                <span className="text-xs text-neutral-500">{formatDateTime(entry.occurredAt)}</span>
              </div>
              <p className="mt-1 text-neutral-700">{entry.outcomeNote}</p>
              <p className="mt-1 text-xs text-neutral-500">By admin {entry.performedByAdminId}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
