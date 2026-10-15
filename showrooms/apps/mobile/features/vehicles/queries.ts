import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { BrokerProfile, Category, Vehicle, VehicleSearchQuery } from "@showrooms/shared";
import { api, apiPaged } from "@/services/api";
import { filtersToQuery } from "@/stores/filters";

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => api<{ makes: Category[]; bodyTypes: Category[] }>("/categories"), staleTime: 10 * 60_000 });
}

export function useVehicleList(key: string, query: string) {
  return useQuery({ queryKey: ["vehicles", key, query], queryFn: ({ signal }) => apiPaged<Vehicle[]>(`/vehicles?${query}`, { signal }) });
}

/** Infinite scroll; TanStack aborts superseded requests through `signal` when filters change. */
export function useVehicleSearch(filters: VehicleSearchQuery) {
  return useInfiniteQuery({
    queryKey: ["vehicles", "search", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => apiPaged<Vehicle[]>(`/vehicles?${filtersToQuery(filters, pageParam)}`, { signal }),
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

export function useTrustedBrokers() {
  return useQuery({ queryKey: ["brokers", "trusted"], queryFn: () => api<BrokerProfile[]>("/brokers?verified=true&limit=8") });
}
