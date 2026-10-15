import { create } from "zustand";
import { toQueryString, type VehicleSearchQuery } from "@showrooms/shared";

/**
 * Search filters live in app state (no URLs on mobile) but use exactly the
 * same keys and values as the web app's query string and the API.
 */
interface FiltersState {
  filters: VehicleSearchQuery;
  set: (patch: Partial<VehicleSearchQuery>) => void;
  reset: () => void;
}

export const useFilters = create<FiltersState>((set) => ({
  filters: { sort: "recommended" },
  set: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  reset: () => set({ filters: { sort: "recommended" } }),
}));

export function filtersToQuery(filters: VehicleSearchQuery, page: number, limit = 20): string {
  return toQueryString({ ...filters, sort: filters.sort === "recommended" ? undefined : filters.sort, page, limit });
}

export function activeFilterCount(f: VehicleSearchQuery): number {
  return Object.entries(f).filter(([k, v]) => k !== "sort" && k !== "q" && v !== undefined && v !== "").length;
}
