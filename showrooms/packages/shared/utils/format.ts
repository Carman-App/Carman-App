import { LABELS } from "../constants/vehicles";

/** KES 1,250,000 */
export function formatKes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString("en-KE")}`;
}

/** KES 1.25M / KES 850K, for tight spaces like cards and posters. */
export function formatKesCompact(amount: number): string {
  if (amount >= 1_000_000) return `KES ${trim(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `KES ${trim(amount / 1_000)}K`;
  return formatKes(amount);
}

const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");

export function formatMileage(km: number): string {
  return `${Math.round(km).toLocaleString("en-KE")} km`;
}

export function formatEngine(cc: number): string {
  return `${cc.toLocaleString("en-KE")} cc`;
}

export function vehicleTitle(v: { year?: number; make?: string; model?: string }): string {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "Untitled vehicle";
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function label<K extends keyof typeof LABELS>(kind: K, value: string | undefined): string {
  if (!value) return "";
  return (LABELS[kind] as Record<string, string>)[value] ?? value;
}
