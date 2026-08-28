"use client";

import { useActionState } from "react";
import { stageCountryDraft, type ActionState } from "../actions";
import { CurrencySymbolPlacement, DistanceUnit, VolumeUnit } from "@/generated/prisma/enums";

const SYMBOL_PLACEMENTS = Object.values(CurrencySymbolPlacement) as string[];
const DISTANCE_UNITS = Object.values(DistanceUnit) as string[];
const VOLUME_UNITS = Object.values(VolumeUnit) as string[];

export type CountryFormValues = {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  currencySymbolPlacement: string;
  distanceUnit: string;
  volumeUnit: string;
  dateFormat: string;
  flagEmoji: string;
  isLive: boolean;
};

export function CountryForm({ code, initial }: { code: string; initial: CountryFormValues }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(stageCountryDraft, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="code" value={code} />
      <div className="grid grid-cols-2 gap-3">
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
          <label className="block text-xs text-neutral-500">Flag emoji</label>
          <input
            name="flagEmoji"
            defaultValue={initial.flagEmoji}
            placeholder="e.g. 🇰🇪"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Currency code</label>
          <input
            name="currencyCode"
            required
            defaultValue={initial.currencyCode}
            placeholder="e.g. KES"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 uppercase"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Currency symbol</label>
          <input
            name="currencySymbol"
            required
            defaultValue={initial.currencySymbol}
            placeholder="e.g. KSh"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Symbol placement</label>
          <select
            name="currencySymbolPlacement"
            defaultValue={initial.currencySymbolPlacement}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            {SYMBOL_PLACEMENTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Date format</label>
          <input
            name="dateFormat"
            required
            defaultValue={initial.dateFormat}
            placeholder="e.g. DD/MM/YYYY"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Distance unit</label>
          <select
            name="distanceUnit"
            defaultValue={initial.distanceUnit}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            {DISTANCE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Volume unit</label>
          <select
            name="volumeUnit"
            defaultValue={initial.volumeUnit}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            {VOLUME_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="isLive" defaultChecked={initial.isLive} className="rounded border-neutral-300" />
        Live (visible to onboarding once mobile reads this table)
      </label>

      <div>
        <label className="block text-xs text-neutral-500">Note (optional context for this draft)</label>
        <textarea
          name="note"
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Staging…" : "Stage draft"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
