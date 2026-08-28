import { Region } from "@/generated/prisma/enums";
import { currencyForRegion } from "@/lib/region";
import { formatMoney } from "@/lib/format";

/**
 * Money (MON-01..10) shared currency helpers.
 *
 * `Plan.priceCents` has no currency field on the model — per AGENTS.md's
 * brief for this work, that is treated as being denominated in one base
 * "reporting currency" (chosen here as USD, a defensible neutral choice for
 * an internal accountant export spanning KE/UG/TZ/NG/ZA/GB/US regions).
 * Every place this assumption matters says so next to the figure.
 */
export const REPORTING_CURRENCY = "USD";

/** cents (Int) -> formatted money string, since most new Money models store Int cents rather than Decimal. */
export function formatCents(cents: number | null | undefined, currency: string = REPORTING_CURRENCY): string {
  if (cents == null) return "—";
  return formatMoney(cents / 100, currency);
}

type RegionLike = { region: Region } | null | undefined;

/**
 * A subscription's real-world currency is never stored directly — it is
 * derived the same way ACCT-10/region.ts does everywhere else: from the
 * owning Account's region (for OWNER-subject subscriptions) or the
 * workshop-owning Account's region (for WORKSHOP-subject subscriptions).
 * This is a *display* derivation, not a stored fact — see src/lib/region.ts.
 */
export function currencyForSubscription(sub: {
  account?: RegionLike;
  workshop?: { owner?: RegionLike } | null;
}): string {
  if (sub.account) return currencyForRegion(sub.account.region);
  if (sub.workshop?.owner) return currencyForRegion(sub.workshop.owner.region);
  return REPORTING_CURRENCY; // no account/workshop resolvable — fall back rather than throw
}
