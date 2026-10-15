import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { formatKes } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { getPlans } from "@/lib/catalog";
import { publicGet } from "@/lib/server-api";
import type { BoostPackage } from "@showrooms/shared";

export const metadata: Metadata = { title: "Pricing", description: "Free to start. Paid plans for brokers and dealers, paid with M-Pesa." };
export const revalidate = 300;

export default async function PricingPage() {
  const [plans, boosts] = await Promise.all([getPlans(), publicGet<BoostPackage[]>("/boosts/packages", 300)]);
  return (
    <div className="container-page py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Simple pricing, paid with M-Pesa</h1>
        <p className="mt-2 text-ink-muted">Start free. Upgrade when your showroom grows. No contracts — plans run month to month.</p>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={`flex flex-col rounded-xl border bg-white p-6 shadow-card ${p.code === "PRO" ? "border-accent ring-1 ring-accent" : "border-border"}`}>
            <p className="text-sm font-semibold text-ink-muted">{p.name}</p>
            <p className="mt-2 text-3xl font-extrabold tabular">{p.priceKes === 0 ? "Free" : formatKes(p.priceKes)}</p>
            {p.priceKes > 0 && <p className="text-sm text-ink-muted">per {p.periodDays} days</p>}
            <p className="mt-3 text-sm text-ink-muted">{p.description}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-2"><Check className="size-4 shrink-0 text-success" /> {h}</li>
              ))}
            </ul>
            <Button className="mt-6" variant={p.code === "PRO" ? "primary" : "outline"} asChild>
              <Link href={p.priceKes === 0 ? "/register?role=BROKER" : `/dashboard/subscription?plan=${p.code}`}>{p.priceKes === 0 ? "Start free" : `Get ${p.name}`}</Link>
            </Button>
          </div>
        ))}
        {!plans.length && <p className="text-ink-muted">Plans are temporarily unavailable.</p>}
      </div>
      {boosts?.data.length ? (
        <section className="mt-14">
          <h2 className="text-xl font-bold">Promote a single listing</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {boosts.data.map((b) => (
              <div key={b.code} className="rounded-lg border border-border bg-white p-5 shadow-card">
                <p className="font-semibold">{b.name}</p>
                <p className="mt-1 text-2xl font-extrabold text-accent tabular">{formatKes(b.priceKes)}</p>
                <p className="mt-1 text-sm text-ink-muted">{b.type === "FEATURED" ? "Top of search and the homepage" : "Higher in search results"} for {b.days} days</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
