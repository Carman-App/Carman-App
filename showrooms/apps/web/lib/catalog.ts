import "server-only";
import type { BrokerProfile, Category, Plan, Vehicle } from "@showrooms/shared";
import { publicGet } from "./server-api";

export interface Catalog {
  makes: Category[];
  bodyTypes: Category[];
}

export async function getCatalog(): Promise<Catalog> {
  const res = await publicGet<Catalog>("/categories", 300);
  return res?.data ?? { makes: [], bodyTypes: [] };
}

export async function getVehicles(query: string, revalidate = 60) {
  const res = await publicGet<Vehicle[]>(`/vehicles?${query}`, revalidate);
  return { items: res?.data ?? [], meta: res?.meta ?? { page: 1, limit: 24, total: 0, totalPages: 0 }, ok: res !== null };
}

export async function getBrokers(query: string) {
  const res = await publicGet<BrokerProfile[]>(`/brokers?${query}`, 120);
  return { items: res?.data ?? [], meta: res?.meta };
}

export async function getPlans(audience?: "BROKER" | "DEALER") {
  const res = await publicGet<Plan[]>(`/subscriptions/plans${audience ? `?audience=${audience}` : ""}`, 300);
  return res?.data ?? [];
}
