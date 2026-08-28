"use client";

import { useActionState, useState } from "react";
import { createBanner, clearBanner, type ActionState } from "./actions";
import { BannerSeverity, Region } from "@/generated/prisma/enums";
import { REGION_LABELS } from "@/lib/region";
import { titleCase } from "@/lib/format";

const SEVERITIES = Object.values(BannerSeverity) as BannerSeverity[];
const REGIONS = Object.values(Region) as Region[];

export function NewBannerForm() {
  const [open, setOpen] = useState(false);
  const [everyone, setEveryone] = useState(true);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createBanner, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
      >
        New banner
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div>
        <label className="block text-xs text-neutral-500">Message</label>
        <textarea
          name="message"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Severity</label>
          <select
            name="severity"
            defaultValue={BannerSeverity.INFO}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Expires at</label>
          <input
            name="expiresAt"
            type="datetime-local"
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          name="everyone"
          checked={everyone}
          onChange={(e) => setEveryone(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Show to everyone
      </label>

      {!everyone && (
        <div className="grid grid-cols-2 gap-3 rounded border border-neutral-200 p-3">
          <p className="col-span-2 text-xs text-neutral-500">
            Same attribute set as segments (src/lib/messaging/segments.ts) — all filters ANDed.
          </p>
          <div>
            <label className="block text-xs text-neutral-500">Region</label>
            <select
              name="region"
              defaultValue=""
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            >
              <option value="">Any</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {REGION_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Plan code</label>
            <input
              name="planCode"
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="hasVehicle" className="rounded border-neutral-300" />
            Has a vehicle
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create banner"}
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
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function ClearBannerButton({ bannerId }: { bannerId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(clearBanner, undefined);
  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="bannerId" value={bannerId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-400 disabled:opacity-60"
      >
        {pending ? "Clearing…" : "Clear for everyone"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
