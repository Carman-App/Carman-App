"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GoToFlagForm() {
  const router = useRouter();
  const [key, setKey] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const k = key.trim();
        if (k) router.push(`/config/flags/${encodeURIComponent(k)}`);
      }}
      className="flex gap-2"
    >
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Flag key, e.g. new_onboarding_flow"
        className="w-64 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
      />
      <button
        type="submit"
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700"
      >
        New / edit flag
      </button>
    </form>
  );
}
