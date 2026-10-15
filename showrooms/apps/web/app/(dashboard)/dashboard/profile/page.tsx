"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { TOWN_NAMES } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/features/auth/auth-provider";
import { useSellerProfile } from "@/features/dashboard/use-seller";
import { VerificationCard } from "@/features/dashboard/verification-card";
import { uploadFile } from "@/features/listings/uploads";
import { api } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";

type Values = Record<string, string>;

function ProfileInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const profile = useSellerProfile();
  const qc = useQueryClient();
  const dealer = user?.role === "DEALER";
  const p = profile.data as Record<string, unknown> | undefined;
  const form = useForm<Values>();
  const owner = !dealer || profile.data?.dealerRole === "OWNER";

  useEffect(() => {
    if (!p) return;
    const keys = dealer ? ["businessName", "description", "phone", "whatsappNumber", "email", "town", "address", "openingHours", "website"] : ["displayName", "bio", "phone", "whatsappNumber", "town", "yearsInBusiness", "facebookUrl", "instagramUrl", "tiktokUrl"];
    form.reset(Object.fromEntries(keys.map((k) => [k, p[k] === undefined || p[k] === null ? "" : String(p[k])])));
  }, [p, dealer, form]);

  async function save(values: Values) {
    const body = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "").map(([k, v]) => [k, k === "yearsInBusiness" ? Number(v) : v]));
    try {
      await api(dealer ? "/dealers/me" : "/brokers/me", { method: "PATCH", body });
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) Object.entries(err.fieldErrors()).forEach(([k, m]) => form.setError(k, { message: m }));
      else toast.error(errorMessage(err));
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    try {
      await uploadFile(file, "PROFILE_LOGO");
      toast.success("Logo updated");
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (!p) return <Skeleton className="h-96" />;
  const e = (k: string) => form.formState.errors[k]?.message as string | undefined;
  const slug = p.slug as string;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={dealer ? "Dealership" : "Broker profile"} description="This is your public showroom page." actions={<Button variant="outline" asChild><Link href={`/${dealer ? "dealers" : "brokers"}/${slug}`} target="_blank"><ExternalLink /> View showroom</Link></Button>} />
      {params.get("welcome") && <div className="rounded-lg border border-success/20 bg-success-soft p-4 text-sm"><strong>Welcome to Showrooms!</strong> Fill in your showroom details, then add your first car.</div>}
      <Card>
        <CardHeader><CardTitle>Showroom details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(save)} className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 sm:col-span-2">
              <div className="grid size-16 place-items-center overflow-hidden rounded-xl bg-ink text-xl font-bold text-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {(p.logo as { url?: string } | undefined)?.url ? <img src={(p.logo as { url: string }).url} alt="Logo" className="h-full w-full object-cover" /> : String(p[dealer ? "businessName" : "displayName"] ?? "?")[0]}
              </div>
              {owner && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-surface">
                  <ImagePlus className="size-4" /> Upload logo
                  <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={(ev) => uploadLogo(ev.target.files?.[0])} />
                </label>
              )}
            </div>
            <fieldset disabled={!owner} className="contents">
              <Field label={dealer ? "Business name" : "Display name"} htmlFor="name" error={e(dealer ? "businessName" : "displayName")} className="sm:col-span-2"><Input id="name" {...form.register(dealer ? "businessName" : "displayName")} /></Field>
              <Field label="About" htmlFor="about" error={e(dealer ? "description" : "bio")} className="sm:col-span-2"><Textarea id="about" {...form.register(dealer ? "description" : "bio")} placeholder="What kind of cars do you sell? Where can buyers view them?" /></Field>
              <Field label="Phone" htmlFor="phone" error={e("phone")}><Input id="phone" type="tel" {...form.register("phone")} /></Field>
              <Field label="WhatsApp number" htmlFor="wa" error={e("whatsappNumber")} hint="Buyers' WhatsApp button opens a chat with this number."><Input id="wa" type="tel" {...form.register("whatsappNumber")} /></Field>
              <Field label="Town" htmlFor="town" error={e("town")}>
                <Select id="town" {...form.register("town")}><option value="">Select…</option>{TOWN_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
              </Field>
              {dealer ? (
                <>
                  <Field label="Address" htmlFor="address" error={e("address")}><Input id="address" {...form.register("address")} /></Field>
                  <Field label="Opening hours" htmlFor="hours" error={e("openingHours")}><Input id="hours" {...form.register("openingHours")} placeholder="Mon–Sat 8:00–18:00" /></Field>
                  <Field label="Email" htmlFor="demail" error={e("email")}><Input id="demail" type="email" {...form.register("email")} /></Field>
                  <Field label="Website" htmlFor="web" error={e("website")}><Input id="web" type="url" {...form.register("website")} /></Field>
                </>
              ) : (
                <>
                  <Field label="Years in business" htmlFor="years" error={e("yearsInBusiness")}><Input id="years" inputMode="numeric" {...form.register("yearsInBusiness")} /></Field>
                  <Field label="Facebook URL" htmlFor="fb" error={e("facebookUrl")}><Input id="fb" type="url" {...form.register("facebookUrl")} /></Field>
                  <Field label="Instagram URL" htmlFor="ig" error={e("instagramUrl")}><Input id="ig" type="url" {...form.register("instagramUrl")} /></Field>
                  <Field label="TikTok URL" htmlFor="tt" error={e("tiktokUrl")}><Input id="tt" type="url" {...form.register("tiktokUrl")} /></Field>
                </>
              )}
              {owner && <Button type="submit" loading={form.formState.isSubmitting} className="sm:col-span-2 sm:justify-self-start">Save profile</Button>}
            </fieldset>
          </form>
        </CardContent>
      </Card>
      {owner && <VerificationCard kind={dealer ? "dealers" : "brokers"} />}
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense><ProfileInner /></Suspense>;
}
