"use client";

import { useActionState } from "react";
import { updatePlan, type ActionState } from "../actions";

export type PlanFormValues = {
  planId: string;
  name: string;
  features: string[];
  trialDays: number | null;
  maxGarages: number | null;
  maxVehicles: number | null;
  maxSeats: number | null;
  maxJobsPerMonth: number | null;
  maxStaff: number | null;
};

export function PlanForm({ initial }: { initial: PlanFormValues }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updatePlan, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="planId" value={initial.planId} />
      <div>
        <label className="block text-xs text-neutral-500">Name</label>
        <input
          name="name"
          required
          defaultValue={initial.name}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-500">Features (comma-separated)</label>
        <textarea
          name="features"
          rows={2}
          defaultValue={initial.features.join(", ")}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Trial days</label>
          <input
            name="trialDays"
            type="number"
            min={0}
            defaultValue={initial.trialDays ?? ""}
            placeholder="blank = none"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Max garages</label>
          <input
            name="maxGarages"
            type="number"
            min={0}
            defaultValue={initial.maxGarages ?? ""}
            placeholder="blank = unlimited"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Max vehicles</label>
          <input
            name="maxVehicles"
            type="number"
            min={0}
            defaultValue={initial.maxVehicles ?? ""}
            placeholder="blank = unlimited"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Max seats</label>
          <input
            name="maxSeats"
            type="number"
            min={0}
            defaultValue={initial.maxSeats ?? ""}
            placeholder="blank = unlimited"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Max jobs/month</label>
          <input
            name="maxJobsPerMonth"
            type="number"
            min={0}
            defaultValue={initial.maxJobsPerMonth ?? ""}
            placeholder="blank = unlimited"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Max staff</label>
          <input
            name="maxStaff"
            type="number"
            min={0}
            defaultValue={initial.maxStaff ?? ""}
            placeholder="blank = unlimited"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save plan"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
