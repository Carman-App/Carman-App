"use client";

import { useActionState, useState } from "react";
import { createSegment, type ActionState } from "./actions";
import { Region } from "@/generated/prisma/enums";
import { REGION_LABELS } from "@/lib/region";

const REGIONS = Object.values(Region) as Region[];

export function SegmentForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createSegment, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500"
      >
        New segment
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
          placeholder="e.g. Kenya owners with a vehicle"
        />
      </div>

      <p className="text-xs text-neutral-500">
        Every filter below is ANDed together. Leave a filter empty/unchecked to not filter on it. See
        src/lib/messaging/segments.ts for exactly what each one computes.
      </p>

      <div className="grid grid-cols-2 gap-3">
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
            placeholder="e.g. OWNER_FREE"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Min account age (days)</label>
          <input
            name="minAccountAgeDays"
            type="number"
            min={0}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-neutral-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hasSubscription" className="rounded border-neutral-300" />
          Has any subscription
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hasVehicle" className="rounded border-neutral-300" />
          Has a vehicle
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="includeSuspended" className="rounded border-neutral-300" />
          Include suspended accounts
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create segment"}
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
