"use client";

import { useActionState } from "react";
import { testSendCampaign, cancelCampaign, type ActionState } from "./actions";

export function TestSendButton({ campaignId }: { campaignId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(testSendCampaign, undefined);
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="campaignId" value={campaignId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Rendering…" : "Test send (renders a preview)"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function CancelButton({ campaignId }: { campaignId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(cancelCampaign, undefined);
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="campaignId" value={campaignId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400 disabled:opacity-60"
      >
        {pending ? "Cancelling…" : "Cancel campaign"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
    </form>
  );
}
