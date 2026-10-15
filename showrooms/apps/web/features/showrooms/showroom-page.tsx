import { CalendarDays, Clock, Globe, MapPin, Phone, Star } from "lucide-react";
import { VERIFICATION_EXPLAINER, whatsappLink, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { VerifiedSellerBadge } from "@/components/vehicles/badges";
import { VehicleGrid } from "@/components/vehicles/vehicle-card";
import { formatDate } from "@/lib/utils";
import { FollowButton } from "./follow-button";
import { Reviews } from "./reviews";

export interface ShowroomData {
  kind: "brokers" | "dealers";
  slug: string;
  name: string;
  about?: string;
  town?: string;
  address?: string;
  openingHours?: string;
  website?: string;
  phone?: string;
  whatsappNumber?: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  activeListingCount: number;
  createdAt: string;
  coverUrl?: string;
}

export function ShowroomPage({ s, vehicles, page, totalPages }: { s: ShowroomData; vehicles: Vehicle[]; page: number; totalPages: number }) {
  const wa = s.whatsappNumber ?? s.phone;
  return (
    <div className="container-page py-8">
      <header className="flex flex-col gap-6 rounded-xl border border-border bg-white p-6 shadow-card sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-ink text-2xl font-extrabold text-white">{s.name[0]}</span>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">{s.name}</h1>
              {s.verified && <VerifiedSellerBadge />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
              {s.town && <span className="flex items-center gap-1"><MapPin className="size-4" /> {s.address ?? s.town}</span>}
              {s.ratingCount > 0 && <span className="flex items-center gap-1"><Star className="size-4 fill-amber-400 text-amber-400" /> {s.ratingAvg.toFixed(1)} ({s.ratingCount} reviews)</span>}
              <span>{s.activeListingCount} cars for sale</span>
              <span>{s.followerCount} followers</span>
              <span className="flex items-center gap-1"><CalendarDays className="size-4" /> On Showrooms since {formatDate(s.createdAt)}</span>
              {s.openingHours && <span className="flex items-center gap-1"><Clock className="size-4" /> {s.openingHours}</span>}
              {s.website && <a href={s.website} rel="nofollow noopener" target="_blank" className="flex items-center gap-1 hover:text-ink"><Globe className="size-4" /> Website</a>}
            </div>
            {s.about && <p className="max-w-2xl text-sm text-ink">{s.about}</p>}
            <p className="max-w-2xl text-xs text-ink-subtle">{s.verified ? VERIFICATION_EXPLAINER.broker : "Not verified yet. Inspect every vehicle carefully before paying."}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col">
          {wa && (
            <Button variant="whatsapp" asChild>
              <a href={whatsappLink(wa, `Hi ${s.name}, I found your showroom on Showrooms.`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </Button>
          )}
          {s.phone && (
            <Button variant="outline" asChild>
              <a href={`tel:${s.phone}`}><Phone /> Call</a>
            </Button>
          )}
          <FollowButton kind={s.kind} slug={s.slug} />
        </div>
      </header>

      <section className="mt-10" aria-labelledby="inventory">
        <h2 id="inventory" className="mb-4 text-xl font-bold">Cars for sale</h2>
        {vehicles.length ? <VehicleGrid vehicles={vehicles} /> : <EmptyState title="No cars listed right now" description="Follow this showroom to hear when new cars arrive." />}
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => `/${s.kind}/${s.slug}?page=${p}`} />
      </section>

      <div className="mt-10 max-w-3xl">
        <Reviews kind={s.kind} slug={s.slug} />
      </div>
    </div>
  );
}
