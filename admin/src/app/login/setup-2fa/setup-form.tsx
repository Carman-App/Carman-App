"use client";

import { useActionState } from "react";
import Image from "next/image";
import { confirmTwoFactorSetup, finishTwoFactorSetupAction, type SetupState } from "../actions";

export default function SetupForm({ initial, next }: { initial: SetupState; next: string }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(
    confirmTwoFactorSetup,
    initial,
  );

  if (state?.backupCodes) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded border border-amber-200 bg-amber-100 p-4">
          <p className="text-sm font-medium text-amber-800">Save these backup codes now</p>
          <p className="mt-1 text-xs text-amber-800/70">
            Each one signs you in once if you lose access to your authenticator. They will not be
            shown again.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm text-neutral-900">
            {state.backupCodes.map((code) => (
              <li key={code} className="rounded bg-white px-2 py-1 text-center">
                {code}
              </li>
            ))}
          </ul>
        </div>
        <form action={finishTwoFactorSetupAction}>
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800"
          >
            I&apos;ve saved my backup codes — continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {state?.qrDataUrl && (
        <div className="flex justify-center rounded bg-neutral-900 p-3">
          {/* Data URI from the server — next/image's optimizer doesn't apply here. */}
          <Image src={state.qrDataUrl} alt="Two-factor setup QR code" width={200} height={200} unoptimized />
        </div>
      )}
      {state?.secret && (
        <div className="rounded border border-neutral-200 bg-white p-3 text-center">
          <p className="text-xs text-neutral-500">Can&apos;t scan? Enter this manually:</p>
          <p className="mt-1 break-all font-mono text-sm text-neutral-800">{state.secret}</p>
        </div>
      )}
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="code" className="block text-sm text-neutral-700">
            6-digit code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            placeholder="123456"
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
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-neutral-100 transition hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Confirming…" : "Confirm and enable"}
        </button>
      </form>
    </div>
  );
}
