import type { ReactNode } from "react";

/**
 * Every CFG screen over a table the mobile app doesn't read yet (all of
 * them except CFG-04's review queue, which has its own gap banner) shows
 * this, prominently, per AGENTS.md: "every single screen you build in this
 * surface must state plainly and visibly in the UI ... that publishing a
 * change here does not yet take effect in the live mobile app."
 */
export function MobileGapBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      {children}
    </div>
  );
}
