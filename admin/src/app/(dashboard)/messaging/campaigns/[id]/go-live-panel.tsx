"use client";

import { useActionState, useState } from "react";
import { sendCampaignNow, scheduleCampaign, type ActionState } from "./actions";

export function GoLivePanel({
  campaignId,
  channel,
  liveCount,
  suppressedCount,
}: {
  campaignId: string;
  channel: string;
  liveCount: number;
  suppressedCount: number;
}) {
  const [step, setStep] = useState<0 | "send" | "schedule">(0);
  const [sendState, sendAction, sendPending] = useActionState<ActionState, FormData>(sendCampaignNow, undefined);
  const [scheduleState, scheduleAction, schedulePending] = useActionState<ActionState, FormData>(
    scheduleCampaign,
    undefined,
  );

  const willReach = liveCount - suppressedCount;

  if (step === 0) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStep("send")}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600"
        >
          Send now
        </button>
        <button
          type="button"
          onClick={() => setStep("schedule")}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500"
        >
          Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm text-neutral-800">
        Live recipient count right now: <strong>{liveCount}</strong>. Suppressed/over frequency-cap:{" "}
        <strong>{suppressedCount}</strong>. This would actually reach <strong>{willReach}</strong> account
        {willReach === 1 ? "" : "s"} over <strong>{channel}</strong>
        {channel !== "IN_APP" && " — but no provider is configured for that channel, so every reached row is recorded as NO_PROVIDER, not actually delivered."}
        . These numbers are recomputed live at send time, so the final counts on the campaign may differ
        slightly if accounts changed in the meantime.
      </p>

      {step === "send" ? (
        <form action={sendAction} className="flex items-center gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <button
            type="submit"
            disabled={sendPending}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {sendPending ? "Sending…" : "Yes, send now"}
          </button>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
          >
            Cancel
          </button>
        </form>
      ) : (
        <form action={scheduleAction} className="space-y-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <label className="block text-xs text-neutral-500">Schedule for</label>
          <input
            name="scheduledAt"
            type="datetime-local"
            required
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={schedulePending}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
            >
              {schedulePending ? "Saving…" : "Confirm schedule"}
            </button>
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {sendState?.error && <p className="text-sm text-red-600">{sendState.error}</p>}
      {sendState?.ok && <p className="text-sm text-emerald-600">{sendState.message}</p>}
      {scheduleState?.error && <p className="text-sm text-red-600">{scheduleState.error}</p>}
      {scheduleState?.ok && <p className="text-sm text-emerald-600">{scheduleState.message}</p>}
    </div>
  );
}
