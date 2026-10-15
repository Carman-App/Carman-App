import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { DealerProfile } from "@showrooms/shared";
import { ShowroomPage } from "@/features/showrooms/showroom-page";
import { getVehicles } from "@/lib/catalog";
import { publicGet } from "@/lib/server-api";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };
type Dealer = DealerProfile & { storefrontEnabled?: boolean };

const load = async (slug: string) => (await publicGet<Dealer>(`/dealers/${encodeURIComponent(slug)}`, 120))?.data ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load((await params).slug);
  if (!d) return { title: "Dealer not found" };
  return { title: `${d.businessName} — car dealer${d.town ? ` in ${d.town}` : ""}`, description: d.description ?? `${d.activeListingCount} cars in stock at ${d.businessName}.`, alternates: { canonical: `/dealers/${d.slug}` } };
}

export default async function DealerPage({ params, searchParams }: Props) {
  const d = await load((await params).slug);
  if (!d) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, meta } = await getVehicles(`dealerId=${d.id}&sort=newest&page=${page}&limit=12`);
  // The full storefront (address, hours, website) is a Dealer-plan feature.
  const full = !!d.storefrontEnabled;
  return (
    <ShowroomPage
      s={{
        kind: "dealers",
        slug: d.slug,
        name: d.businessName,
        about: d.description,
        town: d.town,
        address: full ? d.address : undefined,
        openingHours: full ? d.openingHours : undefined,
        website: full ? d.website : undefined,
        phone: d.phone,
        whatsappNumber: d.whatsappNumber,
        verified: d.verificationStatus === "VERIFIED",
        ratingAvg: d.ratingAvg,
        ratingCount: d.ratingCount,
        followerCount: d.followerCount,
        activeListingCount: d.activeListingCount,
        createdAt: d.createdAt,
      }}
      vehicles={items}
      page={page}
      totalPages={meta.totalPages}
    />
  );
}
