"use client";

import { useActionState, useState } from "react";
import { createCampaign, type ActionState } from "./actions";
import { CampaignChannel, MessageClass } from "@/generated/prisma/enums";
import { titleCase } from "@/lib/format";

const CHANNELS = Object.values(CampaignChannel) as CampaignChannel[];
const CLASSES = Object.values(MessageClass) as MessageClass[];

export function CampaignForm({ segments }: { segments: { id: string; name: string; count: number }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createCampaign, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
      >
        New campaign
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div>
        <label className="block text-xs text-neutral-500">Name</label>
        <input
          name="name"
          required
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Channel</label>
          <select
            name="channel"
            required
            defaultValue=""
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="" disabled>
              Pick…
            </option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Message class</label>
          <select
            name="messageClass"
            required
            defaultValue=""
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="" disabled>
              Pick…
            </option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Segment</label>
          <select
            name="segmentId"
            defaultValue=""
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="">Everyone (no segment)</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500">Subject (optional — used for EMAIL)</label>
        <input
          name="subject"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Body</label>
        <textarea
          name="body"
          required
          rows={4}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">
          Schedule for (optional — recorded only; there is no background scheduler in this codebase, so
          reaching this time doesn&rsquo;t send anything by itself. Someone still has to open the campaign
          and click Send.)
        </label>
        <input
          name="scheduledAt"
          type="datetime-local"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create draft"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
