"use client";

import { useActionState } from "react";
import { requestNewCard, type ActionState } from "./actions";

export function RequestCardButton({ failedPaymentId }: { failedPaymentId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(requestNewCard, undefined);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="failedPaymentId" value={failedPaymentId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Recording…" : "Request new card"}
      </button>
      {state?.message && <span className="text-xs text-neutral-500">{state.message}</span>}
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
