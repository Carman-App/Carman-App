"use client";

import { useActionState } from "react";
import { createAdminUser, type AdminFormState } from "./actions";
import { AdminRole } from "@/generated/prisma/enums";

const ROLES = Object.values(AdminRole) as AdminRole[];

export default function CreateAdminForm() {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(
    createAdminUser,
    undefined,
  );

  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-3 rounded border border-neutral-800 p-4 sm:grid-cols-5"
    >
      <input
        name="name"
        placeholder="Name"
        required
        className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
      />
      <select
        name="role"
        defaultValue={AdminRole.SUPPORT}
        className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <input
        name="password"
        type="text"
        placeholder="Temporary password (8+ chars)"
        required
        minLength={8}
        className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create admin"}
      </button>
      {state?.error && (
        <p className="col-span-full text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="col-span-full text-sm text-emerald-400">
          Admin created. They&rsquo;ll set up two-factor on first sign-in.
        </p>
      )}
    </form>
  );
}
