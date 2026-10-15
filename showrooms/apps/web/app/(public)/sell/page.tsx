import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Camera, Megaphone, MessageCircle, Share2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Sell cars on Showrooms", description: "A digital showroom for Kenyan car brokers and dealers. List once, share to WhatsApp, reach more buyers." };

const STEPS = [
  { icon: Store, title: "Open your showroom", body: "Register as a broker or dealer. Your public showroom page is ready instantly." },
  { icon: Camera, title: "List a car in minutes", body: "Upload photos from your phone, add price and specs. We keep it fast on slow networks." },
  { icon: Share2, title: "Share to WhatsApp", body: "One tap sends a ready-made message to your groups and Status, with a link to the full listing." },
  { icon: MessageCircle, title: "Buyers contact you directly", body: "WhatsApp and call buttons go straight to you. Viewing requests land in your leads." },
  { icon: BarChart3, title: "See what's working", body: "Track views, WhatsApp clicks and viewing requests per car." },
  { icon: Megaphone, title: "Promote when it matters", body: "Boost or feature a listing with M-Pesa when you need it to move faster." },
];

export default function SellPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="container-page py-14">
          <p className="text-sm font-semibold text-accent">For brokers, dealers and private sellers</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">Selling Cars on WhatsApp? Reach More Buyers.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-muted">Showrooms gives you a bigger showroom without replacing WhatsApp. Keep selling the way you do — just to far more people.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link href="/register?role=BROKER">Start Selling</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/register?role=DEALER">I&apos;m a dealership</Link></Button>
          </div>
        </div>
      </section>
      <section className="container-page grid gap-4 py-14 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border border-border bg-white p-6 shadow-card">
            <Icon className="size-6 text-accent" aria-hidden />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{body}</p>
          </div>
        ))}
      </section>
      <section className="container-page">
        <div className="rounded-xl bg-ink p-8 text-white sm:p-10">
          <h2 className="text-2xl font-bold">Free to start</h2>
          <p className="mt-2 max-w-xl text-white/75">List up to 5 cars on the free plan. Upgrade when you need more listings, Status posters and advanced analytics.</p>
          <Button className="mt-6" asChild><Link href="/pricing">See pricing</Link></Button>
        </div>
      </section>
    </>
  );
}
