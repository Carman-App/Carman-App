import { BadgeCheck, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { VERIFICATION_EXPLAINER } from "@showrooms/shared";
import { Badge } from "@/components/ui/badge";

/** Seller identity verified. Never implies anything about a specific car. */
export function VerifiedSellerBadge({ compact }: { compact?: boolean }) {
  return (
    <Badge tone="info" title={VERIFICATION_EXPLAINER.broker}>
      <BadgeCheck aria-hidden /> {compact ? "Verified" : "Verified seller"}
    </Badge>
  );
}

/** Listing details reviewed by staff. Distinct from the seller badge. */
export function VerifiedVehicleBadge() {
  return (
    <Badge tone="success" title={VERIFICATION_EXPLAINER.vehicle}>
      <ShieldCheck aria-hidden /> Verified listing
    </Badge>
  );
}

export function FeaturedBadge() {
  return (
    <Badge tone="dark">
      <Sparkles aria-hidden /> Featured
    </Badge>
  );
}

export function BoostedBadge() {
  return (
    <Badge tone="accent">
      <TrendingUp aria-hidden /> Promoted
    </Badge>
  );
}
