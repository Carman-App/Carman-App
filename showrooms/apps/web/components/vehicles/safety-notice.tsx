import { ShieldAlert } from "lucide-react";
import { VERIFICATION_EXPLAINER } from "@showrooms/shared";

export function SafetyNotice() {
  return (
    <aside className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm" aria-label="Buyer safety">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold text-ink">{VERIFICATION_EXPLAINER.safety}</p>
        <p className="text-ink-muted">Meet in a public place, check the logbook against the seller&apos;s ID, and run an NTSA (eCitizen) search before paying any money.</p>
      </div>
    </aside>
  );
}
