"use client";

import { useActionState, useState } from "react";
import { verifyTwoFactor, type VerifyState } from "../actions";

export default function VerifyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyTwoFactor, undefined);
  const [mode, setMode] = useState<"totp" | "backup">("totp");

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label htmlFor="code" className="block text-sm text-neutral-700">
          {mode === "totp" ? "6-digit code" : "Backup code"}
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode={mode === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder={mode === "totp" ? "123456" : "XXXXX-XXXXX"}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm tracking-widest text-neutral-900 outline-none focus:border-neutral-500"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-carma-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Verify"}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "totp" ? "backup" : "totp")}
        className="w-full text-center text-xs text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
      >
        {mode === "totp" ? "Use a backup code instead" : "Use my authenticator app instead"}
      </button>
    </form>
  );
}
