import type { Metadata } from "next";
import type { BrokerProfile } from "@showrooms/shared";
import { Directory } from "@/features/showrooms/directory";
import { publicGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Car brokers in Kenya", description: "Find trusted car brokers in Nairobi, Mombasa, Kisumu, Nakuru, Eldoret and across Kenya." };

export default async function BrokersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const qs = new URLSearchParams(Object.entries({ q: sp.q, town: sp.town, verified: sp.verified, page: String(page), limit: "24" }).filter(([, v]) => v) as [string, string][]);
  const res = await publicGet<BrokerProfile[]>(`/brokers?${qs}`, 120);
  return (
    <Directory
      kind="brokers"
      title="Car brokers"
      intro="Independent brokers with their own digital showrooms."
      items={(res?.data ?? []).map((b) => ({ id: b.id, slug: b.slug, name: b.displayName, town: b.town, verified: b.verificationStatus === "VERIFIED", activeListingCount: b.activeListingCount, ratingAvg: b.ratingAvg, ratingCount: b.ratingCount, blurb: b.bio }))}
      q={sp.q}
      town={sp.town}
      verified={sp.verified}
      page={page}
      totalPages={res?.meta?.totalPages ?? 0}
    />
  );
}
