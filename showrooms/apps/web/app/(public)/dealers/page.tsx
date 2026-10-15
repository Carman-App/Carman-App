import type { Metadata } from "next";
import type { DealerProfile } from "@showrooms/shared";
import { Directory } from "@/features/showrooms/directory";
import { publicGet } from "@/lib/server-api";

export const metadata: Metadata = { title: "Car dealers in Kenya", description: "Browse car yards and dealerships across Kenya with live inventory and prices in KES." };

export default async function DealersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const qs = new URLSearchParams(Object.entries({ q: sp.q, town: sp.town, verified: sp.verified, page: String(page), limit: "24" }).filter(([, v]) => v) as [string, string][]);
  const res = await publicGet<DealerProfile[]>(`/dealers?${qs}`, 120);
  return (
    <Directory
      kind="dealers"
      title="Car dealers"
      intro="Yards and dealerships with full inventory online."
      items={(res?.data ?? []).map((d) => ({ id: d.id, slug: d.slug, name: d.businessName, town: d.town, verified: d.verificationStatus === "VERIFIED", activeListingCount: d.activeListingCount, ratingAvg: d.ratingAvg, ratingCount: d.ratingCount, blurb: d.description }))}
      q={sp.q}
      town={sp.town}
      verified={sp.verified}
      page={page}
      totalPages={res?.meta?.totalPages ?? 0}
    />
  );
}
