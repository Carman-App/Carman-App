"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PlusCircle } from "lucide-react";
import type { Inquiry, SellerAnalytics, Vehicle } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Stat, Skeleton } from "@/components/ui/misc";
import { VehicleGrid } from "@/components/vehicles/vehicle-card";
import { isSeller, useAuth } from "@/features/auth/auth-provider";
import { useSellerProfile } from "@/features/dashboard/use-seller";
import { api, apiPaged } from "@/lib/api-client";
import { relativeTime } from "@/lib/utils";

function SellerOverview() {
  const profile = useSellerProfile();
  const analytics = useQuery({ queryKey: ["analytics", 30], queryFn: () => api<SellerAnalytics>("/analytics/seller?days=30") });
  const leads = useQuery({ queryKey: ["leads", "recent"], queryFn: () => apiPaged<Inquiry[], { newCount: number }>("/broker/inquiries?limit=5") });
  const a = analytics.data;
  const ent = profile.data?.entitlements;
  return (
    <>
      <PageHeader title="Overview" description="Last 30 days" actions={<Button asChild><Link href="/dashboard/vehicles/new"><PlusCircle /> Add vehicle</Link></Button>} />
      {profile.data && profile.data.verificationStatus !== "VERIFIED" && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-info/20 bg-info-soft p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p><strong>Get verified</strong> — buyers trust verified sellers more. {profile.data.verificationStatus === "PENDING" ? "Your documents are being reviewed." : "Submit your ID to get a badge."}</p>
          {profile.data.verificationStatus !== "PENDING" && <Button size="sm" variant="secondary" asChild><Link href="/dashboard/profile#verification">Verify now</Link></Button>}
        </div>
      )}
      {!a ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Active listings" value={a.listings.ACTIVE} hint={ent ? `of ${ent.listingLimit} on ${ent.planName}` : undefined} />
          <Stat label="Pending review" value={a.listings.PENDING_REVIEW} />
          <Stat label="Total views" value={a.totals.views.toLocaleString("en-KE")} />
          <Stat label="Viewing requests" value={a.totals.viewingRequests} />
          <Stat label="WhatsApp taps" value={a.totals.whatsappClicks} hint="Taps on the button, not confirmed chats" />
          <Stat label="Call taps" value={a.totals.callClicks} />
          <Stat label="Sold" value={a.listings.SOLD} />
          <Stat label="Saved by buyers" value={a.totals.favorites} />
        </div>
      )}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Latest leads {leads.data?.meta.newCount ? <span className="ml-1 rounded-full bg-accent px-2 text-sm text-white">{leads.data.meta.newCount} new</span> : null}</h2>
          <Link href="/dashboard/inquiries" className="flex items-center gap-1 text-sm font-semibold text-accent">All leads <ArrowRight className="size-4" /></Link>
        </div>
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {leads.data?.data.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0"><span className="font-semibold">{l.buyer?.name}</span> · {l.type === "VIEWING_REQUEST" ? "viewing request" : "question"} · <span className="text-ink-muted">{l.vehicle?.title}</span></span>
              <span className="shrink-0 text-xs text-ink-subtle">{relativeTime(l.createdAt)}</span>
            </li>
          ))}
          {leads.data && !leads.data.data.length && <li className="p-4 text-sm text-ink-muted">No leads yet. Share your listings to WhatsApp to get buyers in.</li>}
        </ul>
      </section>
    </>
  );
}

function BuyerOverview() {
  const saved = useQuery({ queryKey: ["favorites", "list", 1], queryFn: () => apiPaged<Vehicle[]>("/favorites?limit=4") });
  const inquiries = useQuery({ queryKey: ["inquiries", "me"], queryFn: () => apiPaged<Inquiry[]>("/inquiries/me?limit=5") });
  return (
    <>
      <PageHeader title="My account" actions={<Button asChild><Link href="/vehicles">Browse cars</Link></Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saved cars" value={saved.data?.meta.total ?? "—"} />
        <Stat label="Inquiries sent" value={inquiries.data?.meta.total ?? "—"} />
      </div>
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Recently saved</h2>
        {saved.data?.data.length ? <VehicleGrid vehicles={saved.data.data} /> : <p className="text-sm text-ink-muted">Tap the heart on any car to save it here.</p>}
      </section>
      <section className="mt-8 rounded-lg border border-border bg-white p-5">
        <h2 className="font-bold">Selling a car?</h2>
        <p className="mt-1 text-sm text-ink-muted">Brokers and dealers get a free showroom with WhatsApp sharing. Contact support to switch your account type, or create a seller account.</p>
      </section>
    </>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  return isSeller(user) ? <SellerOverview /> : <BuyerOverview />;
}
