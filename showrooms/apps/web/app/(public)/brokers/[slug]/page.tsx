import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BrokerProfile } from "@showrooms/shared";
import { ShowroomPage } from "@/features/showrooms/showroom-page";
import { getVehicles } from "@/lib/catalog";
import { publicGet } from "@/lib/server-api";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

const load = async (slug: string) => (await publicGet<BrokerProfile>(`/brokers/${encodeURIComponent(slug)}`, 120))?.data ?? null;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await load((await params).slug);
  if (!b) return { title: "Broker not found" };
  return { title: `${b.displayName} — car broker${b.town ? ` in ${b.town}` : ""}`, description: b.bio ?? `${b.activeListingCount} cars for sale from ${b.displayName} on Showrooms.`, alternates: { canonical: `/brokers/${b.slug}` } };
}

export default async function BrokerPage({ params, searchParams }: Props) {
  const b = await load((await params).slug);
  if (!b) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, meta } = await getVehicles(`sellerId=${b.userId}&sort=newest&page=${page}&limit=12`);
  return (
    <ShowroomPage
      s={{ kind: "brokers", slug: b.slug, name: b.displayName, about: b.bio, town: b.town, phone: b.phone, whatsappNumber: b.whatsappNumber, verified: b.verificationStatus === "VERIFIED", ratingAvg: b.ratingAvg, ratingCount: b.ratingCount, followerCount: b.followerCount, activeListingCount: b.activeListingCount, createdAt: b.createdAt }}
      vehicles={items}
      page={page}
      totalPages={meta.totalPages}
    />
  );
}
