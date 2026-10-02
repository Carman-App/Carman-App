"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Simple client-side nav helper: types an ISO alpha-2 code and jumps to its
 * draft/edit page, which creates the row if it doesn't exist yet (same
 * "no row yet, saving creates one" pattern as Messaging's
 * templates/[key]/page.tsx).
 */
export function GoToCountryForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(c)) router.push(`/config/countries/${c}`);
      }}
      className="flex gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ISO code, e.g. KE"
        maxLength={2}
        className="w-40 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 uppercase"
      />
      <button
        type="submit"
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700"
      >
        Add / edit country
      </button>
    </form>
  );
}
