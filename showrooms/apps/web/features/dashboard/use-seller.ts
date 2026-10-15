"use client";

import { useQuery } from "@tanstack/react-query";
import type { BrokerProfile, DealerProfile, Entitlements } from "@showrooms/shared";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api-client";

export type SellerProfile = (BrokerProfile | DealerProfile) & { entitlements: Entitlements; dealerRole?: "OWNER" | "MANAGER" | "SALES" };

export function useSellerProfile() {
  const { user } = useAuth();
  const path = user?.role === "DEALER" ? "/dealers/me" : "/brokers/me";
  return useQuery({ queryKey: ["seller-profile", user?.id], queryFn: () => api<SellerProfile>(path), enabled: user?.role === "BROKER" || user?.role === "DEALER" });
}

export function sellerName(p: SellerProfile | undefined, fallback = ""): string {
  if (!p) return fallback;
  return "businessName" in p ? p.businessName : p.displayName;
}
