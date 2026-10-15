import { useQuery } from "@tanstack/react-query";
import type { Entitlements } from "@showrooms/shared";
import { api } from "@/services/api";
import { useAuth } from "@/stores/auth";

export interface SellerProfile {
  id: string;
  slug: string;
  displayName?: string;
  businessName?: string;
  verificationStatus: string;
  dealerRole?: "OWNER" | "MANAGER" | "SALES";
  entitlements: Entitlements;
  activeListingCount: number;
}

export function useSellerProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["seller-profile", user?.id],
    queryFn: () => api<SellerProfile>(user?.role === "DEALER" ? "/dealers/me" : "/brokers/me"),
    enabled: user?.role === "BROKER" || user?.role === "DEALER",
  });
}

export const sellerName = (p?: SellerProfile, fallback = "") => p?.businessName ?? p?.displayName ?? fallback;
