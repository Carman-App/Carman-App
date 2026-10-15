import Link from "next/link";
import { POPULAR_TOWNS, VERIFICATION_EXPLAINER } from "@showrooms/shared";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-ink-muted">A bigger showroom for Kenyan car brokers — without replacing WhatsApp.</p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Buy</p>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><Link href="/vehicles">All vehicles</Link></li>
            {POPULAR_TOWNS.slice(0, 4).map((t) => (
              <li key={t}><Link href={`/vehicles?town=${encodeURIComponent(t)}`}>Cars in {t}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Sell</p>
          <ul className="space-y-2 text-sm text-ink-muted">
            <li><Link href="/sell">Sell on Showrooms</Link></li>
            <li><Link href="/pricing">Pricing</Link></li>
            <li><Link href="/how-it-works">How it works</Link></li>
            <li><Link href="/brokers">Broker directory</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Stay safe</p>
          <p className="text-sm text-ink-muted">{VERIFICATION_EXPLAINER.safety} Never send a deposit before you have seen the car and its logbook.</p>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-ink-subtle sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Showrooms. Prices in Kenyan shillings (KES).</p>
          <p>Nairobi · Mombasa · Kisumu · Nakuru · Eldoret</p>
        </div>
      </div>
    </footer>
  );
}
