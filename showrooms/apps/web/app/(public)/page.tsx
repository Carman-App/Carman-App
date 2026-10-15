import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, MessageCircle, ShieldCheck, Sparkles, Store } from "lucide-react";
import { KENYAN_TOWNS } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { VerifiedSellerBadge } from "@/components/vehicles/badges";
import { VehicleGrid } from "@/components/vehicles/vehicle-card";
import { HeroSearch } from "@/features/search/hero-search";
import { getBrokers, getCatalog, getVehicles } from "@/lib/catalog";

export const revalidate = 60;

function Section({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="container-page py-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            {linkLabel ?? "See all"} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const [catalog, featured, recent, brokers] = await Promise.all([
    getCatalog(),
    getVehicles("featured=true&limit=4&sort=newest"),
    getVehicles("sort=newest&limit=8"),
    getBrokers("verified=true&limit=6"),
  ]);
  const popularMakes = catalog.makes.filter((m) => m.isPopular);
  const bodyTypes = catalog.bodyTypes.filter((b) => b.isPopular);

  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="container-page py-12 sm:py-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">Find Your Next Car.</h1>
            <p className="mt-3 text-lg text-ink-muted">Discover vehicles from brokers, dealers, and independent sellers across Kenya.</p>
          </div>
          <div className="mt-8">
            <HeroSearch makes={catalog.makes} />
          </div>
          {popularMakes.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-muted">Popular:</span>
              {popularMakes.map((m) => (
                <Link key={m.id} href={`/vehicles?make=${encodeURIComponent(m.name)}`} className="rounded-full border border-border bg-white px-3 py-1 text-sm font-medium hover:border-ink">
                  {m.name} {m.vehicleCount ? <span className="text-ink-subtle">({m.vehicleCount})</span> : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {featured.items.length > 0 && (
        <Section title="Featured vehicles" href="/vehicles?featured=true">
          <VehicleGrid vehicles={featured.items} />
        </Section>
      )}

      <Section title="Recently listed" href="/vehicles?sort=newest">
        {recent.items.length ? (
          <VehicleGrid vehicles={recent.items} />
        ) : (
          <p className="text-ink-muted">{recent.ok ? "No vehicles listed yet. Check back soon." : "Listings are temporarily unavailable."}</p>
        )}
      </Section>

      {bodyTypes.length > 0 && (
        <Section title="Browse by body type">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {bodyTypes.map((b) => (
              <Link key={b.id} href={`/vehicles?bodyType=${b.bodyType}`} className="rounded-lg border border-border bg-white p-4 shadow-card hover:border-ink">
                <p className="font-semibold">{b.name}</p>
                <p className="text-sm text-ink-muted">{b.vehicleCount ?? 0} listed</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {brokers.items.length > 0 && (
        <Section title="Trusted brokers" href="/brokers?verified=true">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {brokers.items.map((b) => (
              <Link key={b.id} href={`/brokers/${b.slug}`} className="flex items-center gap-4 rounded-lg border border-border bg-white p-4 shadow-card hover:border-ink">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-lg font-bold text-white">{b.displayName[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{b.displayName}</span>
                    <VerifiedSellerBadge compact />
                  </span>
                  <span className="mt-0.5 flex items-center gap-3 text-sm text-ink-muted">
                    {b.town && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" /> {b.town}
                      </span>
                    )}
                    <span>{b.activeListingCount} cars</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Popular locations">
        <div className="flex flex-wrap gap-2">
          {KENYAN_TOWNS.filter((t) => t.popular).map((t) => (
            <Link key={t.town} href={`/vehicles?town=${encodeURIComponent(t.town)}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium hover:border-ink">
              <MapPin className="size-4 text-accent" /> Cars in {t.town}
            </Link>
          ))}
        </div>
      </Section>

      <section className="container-page py-10">
        <h2 className="mb-5 text-xl font-bold tracking-tight sm:text-2xl">Why buy through Showrooms</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BadgeCheck, title: "Verified sellers", body: "We check broker and dealer identity, and say clearly what that does and doesn't cover." },
            { icon: MessageCircle, title: "WhatsApp the seller", body: "Talk directly to the person selling, the way you already do." },
            { icon: ShieldCheck, title: "Report anything off", body: "Suspicious listing? Report it and our team reviews it." },
            { icon: Sparkles, title: "Prices in KES", body: "Clear prices, mileage and specs up front — no 'inbox for price'." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border border-border bg-white p-5 shadow-card">
              <Icon className="size-6 text-accent" aria-hidden />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-ink-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-10">
        <div className="flex flex-col items-start gap-6 rounded-xl bg-ink p-8 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <Store className="size-8 text-orange-400" aria-hidden />
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Selling Cars on WhatsApp? Reach More Buyers.</h2>
            <p className="mt-2 text-white/75">Get a digital showroom, list every car once, and share each listing straight to your WhatsApp Status and groups.</p>
          </div>
          <Button size="lg" asChild>
            <Link href="/register?role=BROKER">Start Selling</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
