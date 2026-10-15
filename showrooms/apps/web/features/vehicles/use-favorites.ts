"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api-client";

export function useFavoriteIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites", "ids", user?.id],
    queryFn: () => api<string[]>("/favorites/ids"),
    enabled: !!user,
    staleTime: 60_000,
  });
}
