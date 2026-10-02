"use client";

import { useActionState, useState } from "react";
import { upsertListItem, deleteListItem, type ActionState } from "../actions";

export type ListItemValues = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  metadata: unknown;
};

export function NewListItemForm({ listKey }: { listKey: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(upsertListItem, undefined);
  return (
    <form action={formAction} className="space-y-2 rounded border border-neutral-200 p-4">
      <input type="hidden" name="listKey" value={listKey} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Code (stable machine key)</label>
          <input
            name="code"
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Label</label>
          <input
            name="label"
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Sort order</label>
          <input
            name="sortOrder"
            type="number"
            defaultValue={0}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Metadata (JSON, optional)</label>
          <input
            name="metadata"
            placeholder='e.g. {"vehicleClass":"CAR","intervalKm":10000}'
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="isActive" defaultChecked className="rounded border-neutral-300" />
        Active
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add item"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function ListItemRow({ listKey, item }: { listKey: string; item: ListItemValues }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(upsertListItem, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteListItem, undefined);

  if (!open) {
    return (
      <tr className="border-t border-neutral-200">
        <td className="px-3 py-2 text-sm text-neutral-600">{item.sortOrder}</td>
        <td className="px-3 py-2 text-sm text-neutral-800">{item.code}</td>
        <td className="px-3 py-2 text-sm text-neutral-800">{item.label}</td>
        <td className="px-3 py-2 text-sm text-neutral-600">{item.isActive ? "Active" : "Inactive"}</td>
        <td className="px-3 py-2 text-xs text-neutral-500">{item.metadata ? JSON.stringify(item.metadata) : "—"}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:border-neutral-500"
            >
              Edit
            </button>
            {item.isActive && (
              <form action={deleteAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <button
                  type="submit"
                  disabled={deletePending}
                  title="Hides this item from apps without deleting it — recoverable via Edit."
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-400 disabled:opacity-60"
                >
                  {deletePending ? "Deactivating…" : "Deactivate"}
                </button>
              </form>
            )}
          </div>
          {deleteState?.error && <p className="mt-1 text-xs text-red-600">{deleteState.error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-neutral-200">
      <td colSpan={6} className="p-3">
        <form action={formAction} className="space-y-2 rounded border border-neutral-300 bg-neutral-100 p-3">
      <input type="hidden" name="listKey" value={listKey} />
      <input type="hidden" name="itemId" value={item.id} />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="code"
          required
          defaultValue={item.code}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
        <input
          name="label"
          required
          defaultValue={item.label}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
        <input
          name="sortOrder"
          type="number"
          defaultValue={item.sortOrder}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
        <input
          name="metadata"
          defaultValue={item.metadata ? JSON.stringify(item.metadata) : ""}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="isActive" defaultChecked={item.isActive} className="rounded border-neutral-300" />
        Active
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
    </form>
      </td>
    </tr>
  );
}
