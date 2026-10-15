import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CalendarDays, Star } from "lucide-react";
import { formatEngine, formatKes, formatMileage, label, VERIFICATION_EXPLAINER, type Vehicle } from "@showrooms/shared";
import { Badge } from "@/components/ui/badge";
import { VerifiedSellerBadge, VerifiedVehicleBadge } from "@/components/vehicles/badges";
import { SafetyNotice } from "@/components/vehicles/safety-notice";
import { VehicleGrid } from "@/components/vehicles/vehicle-card";
import { ContactButtons, ReportListing, RequestViewing, SaveButton, ShareButton, ViewTracker } from "@/features/vehicle-detail/actions";
import { Gallery } from "@/features/vehicle-detail/gallery";
import { publicGet } from "@/lib/server-api";
import { listingUrl, relativeTime } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

async function load(slug: string) {
  return (await publicGet<Vehicle>(`/vehicles/${encodeURIComponent(slug)}`, 60))?.data ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const v = await load((await params).slug);
  if (!v) return { title: "Vehicle not found", robots: { index: false } };
  const title = `${v.title} for ${formatKes(v.price)} in ${v.location.town}`;
  const description = `${v.title}, ${formatMileage(v.mileage)}, ${label("transmission", v.transmission)}, ${label("fuelType", v.fuelType)}. ${v.description.slice(0, 120)}`;
  return {
    title,
    description,
    alternates: { canonical: `/vehicles/${v.slug}` },
    openGraph: { title, description, url: listingUrl(v.slug), type: "website" },
    robots: v.status === "SOLD" ? { index: false } : undefined,
  };
}

export default async function VehicleDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const v = await load(slug);
  if (!v) notFound();
  if (v.slug !== slug) permanentRedirect(`/vehicles/${v.slug}`);
  const similar = (await publicGet<Vehicle[]>(`/vehicles/${v.id}/similar`, 300))?.data ?? [];

  const specs: [string, string][] = [
    ["Year", String(v.year)],
    ["Mileage", formatMileage(v.mileage)],
    ["Transmission", label("transmission", v.transmission)],
    ["Fuel", label("fuelType", v.fuelType)],
    ["Engine", formatEngine(v.engineCapacity)],
    ["Body type", label("bodyType", v.bodyType)],
    ["Drive", label("driveType", v.driveType)],
    ["Colour", v.color],
    ["Condition", label("condition", v.condition)],
    ["Availability", label("importStatus", v.importStatus)],
    ["Location", [v.location.area, v.location.town].filter(Boolean).join(", ")],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: v.title,
    brand: { "@type": "Brand", name: v.make },
    model: v.model,
    vehicleModelDate: String(v.year),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileage, unitCode: "KMT" },
    fuelType: label("fuelType", v.fuelType),
    vehicleTransmission: label("transmission", v.transmission),
    bodyType: label("bodyType", v.bodyType),
    color: v.color,
    image: v.images.map((i) => i.url),
    url: listingUrl(v.slug),
    offers: {
      "@type": "Offer",
      price: v.price,
      priceCurrency: "KES",
      availability: v.status === "SOLD" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
      areaServed: v.location.town,
    },
  };

  return (
    <div className="container-page pt-6 pb-28 lg:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ViewTracker vehicleId={v.id} />
      <nav className="mb-4 text-sm text-ink-muted" aria-label="Breadcrumb">
        <Link href="/vehicles" className="hover:text-ink">Vehicles</Link> / <Link href={`/vehicles?make=${encodeURIComponent(v.make)}`} className="hover:text-ink">{v.make}</Link> / <span className="text-ink">{v.model}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-8">
          <Gallery title={v.title} images={v.images} videos={v.videos} />

          <section aria-labelledby="specs">
            <h2 id="specs" className="mb-3 text-lg font-bold">Specifications</h2>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
              {specs.map(([k, val]) => (
                <div key={k} className="bg-white p-3">
                  <dt className="text-xs text-ink-muted">{k}</dt>
                  <dd className="mt-0.5 font-semibold">{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="description">
            <h2 id="description" className="mb-3 text-lg font-bold">Description</h2>
            <p className="whitespace-pre-line text-ink-muted">{v.description}</p>
            {v.features.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {v.features.map((f) => (
                  <li key={f}><Badge>{f}</Badge></li>
                ))}
              </ul>
            )}
          </section>

          <SafetyNotice />
        </div>

        <aside className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border bg-white p-5 shadow-card lg:sticky lg:top-20">
            <div className="flex flex-wrap gap-1.5">
              {v.status === "SOLD" && <Badge tone="danger">Sold</Badge>}
              {v.isVerified && <VerifiedVehicleBadge />}
              {v.isFeatured && <Badge tone="dark">Featured</Badge>}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{v.title}</h1>
            <div>
              <p className="tabular text-3xl font-extrabold text-accent">{formatKes(v.price)}</p>
              {v.priceNegotiable && <p className="text-sm text-ink-muted">Negotiable</p>}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <CalendarDays className="size-3.5" /> Listed {relativeTime(v.publishedAt)}
            </p>
            <ContactButtons vehicle={v} />
            <RequestViewing vehicle={v} />
            <div className="flex gap-2">
              <SaveButton vehicleId={v.id} />
              <ShareButton vehicle={v} />
            </div>
          </div>

          {v.seller && (
            <div className="space-y-3 rounded-lg border border-border bg-white p-5 shadow-card">
              <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{v.seller.type === "DEALER" ? "Dealer" : "Broker"}</p>
              <Link href={`/${v.seller.type === "DEALER" ? "dealers" : "brokers"}/${v.seller.slug}`} className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-ink text-lg font-bold text-white">{v.seller.name[0]}</span>
                <span>
                  <span className="block font-semibold hover:underline">{v.seller.name}</span>
                  <span className="text-sm text-ink-muted">{v.seller.town}</span>
                </span>
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {v.seller.isVerified && <VerifiedSellerBadge />}
                {v.seller.ratingCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-ink-muted">
                    <Star className="size-4 fill-amber-400 text-amber-400" /> {v.seller.ratingAvg.toFixed(1)} ({v.seller.ratingCount})
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-subtle">{v.seller.isVerified ? VERIFICATION_EXPLAINER.broker : "This seller has not been verified yet. Take extra care."}</p>
              {v.isVerified && <p className="text-xs text-ink-subtle">{VERIFICATION_EXPLAINER.vehicle}</p>}
            </div>
          )}
          <div className="px-1">
            <ReportListing vehicle={v} />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mt-12" aria-labelledby="similar">
          <h2 id="similar" className="mb-4 text-xl font-bold">Similar vehicles</h2>
          <VehicleGrid vehicles={similar.slice(0, 4)} />
        </section>
      )}

      {/* WhatsApp and Call stay within thumb reach on phones. */}
      {v.status === "ACTIVE" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white p-3 shadow-raised lg:hidden">
          <ContactButtons vehicle={v} layout="bar" />
        </div>
      )}
    </div>
  );
}
