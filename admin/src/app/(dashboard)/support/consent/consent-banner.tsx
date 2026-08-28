import { formatDateTime } from "@/lib/format";

/**
 * SUP-03 scaffolding component. This is what a banner would look like on a
 * real "view the app as the user" screen — but no such screen exists in
 * this codebase, and this component is not mounted on any page that
 * fetches or displays another account's live data. It is rendered here
 * (support/consent) purely as a preview of the intended UI treatment.
 *
 * There is no mobile-side consent handshake to wire this into yet — see
 * ConsentSession's schema comment and AGENTS.md's SUP-03 note.
 */
export function ConsentBanner({
  accountLabel,
  expiresAt,
  consentMethod,
}: {
  accountLabel: string;
  expiresAt: Date;
  consentMethod: string;
}) {
  const expired = expiresAt.getTime() < new Date().getTime();
  return (
    <div
      className={`rounded border px-3 py-2 text-xs ${
        expired ? "border-neutral-300 bg-neutral-50 text-neutral-500" : "border-amber-300 bg-amber-100 text-amber-800"
      }`}
    >
      <p className="font-medium">
        {expired ? "Consent session expired" : "Viewing under a time-boxed consent session"} — {accountLabel}
      </p>
      <p>
        Consent method: {consentMethod}. {expired ? "Expired" : "Expires"} {formatDateTime(expiresAt)}.
      </p>
      <p className="mt-1 text-neutral-500">
        Preview only — this banner is not attached to any real data-viewing page. No admin tool in
        this codebase actually reads this account&rsquo;s live app data as a result of a consent
        session.
      </p>
    </div>
  );
}
