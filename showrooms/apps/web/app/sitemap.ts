import type { MetadataRoute } from "next";
import type { BrokerProfile, DealerProfile, Vehicle } from "@showrooms/shared";
import { publicGet } from "@/lib/server-api";
import { SITE_URL } from "@/lib/utils";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ["", "/vehicles", "/brokers", "/dealers", "/sell", "/pricing", "/how-it-works"].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "daily" as const }));
  const vehicles: Vehicle[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await publicGet<Vehicle[]>(`/vehicles?sort=newest&limit=48&page=${page}`, 3600);
    vehicles.push(...(res?.data ?? []));
    if (!res?.meta || page >= res.meta.totalPages) break;
  }
  const [brokers, dealers] = await Promise.all([publicGet<BrokerProfile[]>("/brokers?limit=50", 3600), publicGet<DealerProfile[]>("/dealers?limit=50", 3600)]);
  return [
    ...statics,
    ...vehicles.map((v) => ({ url: `${SITE_URL}/vehicles/${v.slug}`, lastModified: v.updatedAt, changeFrequency: "weekly" as const })),
    ...(brokers?.data ?? []).map((b) => ({ url: `${SITE_URL}/brokers/${b.slug}` })),
    ...(dealers?.data ?? []).map((d) => ({ url: `${SITE_URL}/dealers/${d.slug}` })),
  ];
}
