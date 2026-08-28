"use client";

import { useActionState, useState } from "react";
import { createWhatsNewNote, publishWhatsNewNote, type ActionState } from "./actions";

export function NewWhatsNewForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createWhatsNewNote, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800"
      >
        New note
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Version</label>
          <input
            name="version"
            required
            placeholder="e.g. 2.4.0"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Title</label>
          <input
            name="title"
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Body</label>
        <textarea
          name="body"
          required
          rows={4}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="publishNow" defaultChecked className="rounded border-neutral-300" />
        Publish immediately
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create note"}
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

export function PublishButton({ noteId }: { noteId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(publishWhatsNewNote, undefined);
  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="noteId" value={noteId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Publish"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
