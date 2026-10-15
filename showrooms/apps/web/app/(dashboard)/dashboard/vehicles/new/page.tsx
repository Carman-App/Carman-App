"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Category, Vehicle } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useSellerProfile } from "@/features/dashboard/use-seller";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

/** Step 0: what car is it? Creates the draft so photos can be uploaded against it. */
export default function NewVehiclePage() {
  const router = useRouter();
  const profile = useSellerProfile();
  const catalog = useQuery({ queryKey: ["categories"], queryFn: () => api<{ makes: Category[] }>("/categories") });
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const models = catalog.data?.makes.find((m) => m.name === make)?.models ?? [];
  const ent = profile.data?.entitlements;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const draft = await api<Vehicle>("/vehicles", { method: "POST", body: { make: make || undefined, model: model || undefined, year: year ? Number(year) : undefined } });
      router.replace(`/dashboard/vehicles/${draft.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Add a vehicle" description="Start with the basics. You'll add photos, price and details next — your draft saves as you go." />
      {ent && ent.activeListings >= ent.listingLimit && (
        <p className="mb-4 rounded-lg bg-warning-soft p-4 text-sm">You&apos;re using all {ent.listingLimit} active listings on the {ent.planName} plan. You can still prepare a draft; upgrade or mark a car sold to publish it.</p>
      )}
      <form onSubmit={start} className="grid gap-4 rounded-lg border border-border bg-white p-5 shadow-card">
        <Field label="Make" htmlFor="make">
          <Select id="make" value={make} onChange={(e) => (setMake(e.target.value), setModel(""))} required>
            <option value="">Select…</option>
            {catalog.data?.makes.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Model" htmlFor="model">
          <Input id="model" list="models" value={model} onChange={(e) => setModel(e.target.value)} required />
          <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Field label="Year" htmlFor="year">
          <Input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2017" required />
        </Field>
        <Button type="submit" loading={busy}>Continue to photos</Button>
      </form>
    </div>
  );
}
