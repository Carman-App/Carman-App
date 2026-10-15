"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BODY_TYPES, CONDITIONS, FUEL_TYPES, IMPORT_STATUSES, LABELS, TOWN_NAMES, TRANSMISSIONS, VEHICLE_SORTS, type Category } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => thisYear - i);

function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return { params, set, pending, clear: () => start(() => router.push(pathname)) };
}

function FilterFields({ makes }: { makes: Category[] }) {
  const { params, set } = useUrlFilters();
  const make = params.get("make") ?? "";
  const models = makes.find((m) => m.name.toLowerCase() === make.toLowerCase())?.models ?? [];
  const select = (name: string, label: string, options: readonly string[], labels?: Record<string, string>) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Select id={`f-${name}`} value={params.get(name) ?? ""} onChange={(e) => set({ [name]: e.target.value })}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </Select>
    </div>
  );
  const numberInput = (name: string, label: string, placeholder: string) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`f-${name}`}>{label}</Label>
      <Input
        id={`f-${name}`}
        inputMode="numeric"
        placeholder={placeholder}
        defaultValue={params.get(name) ?? ""}
        onBlur={(e) => set({ [name]: e.target.value.replace(/\D/g, "") || undefined })}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="f-make">Make</Label>
        <Select id="f-make" value={make} onChange={(e) => set({ make: e.target.value, model: undefined })}>
          <option value="">Any make</option>
          {makes.map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </Select>
      </div>
      {models.length > 0 && select("model", "Model", models)}
      <div className="grid grid-cols-2 gap-2">
        {numberInput("minPrice", "Min price (KES)", "300000")}
        {numberInput("maxPrice", "Max price (KES)", "2000000")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {select("minYear", "Year from", YEARS.map(String))}
        {select("maxYear", "Year to", YEARS.map(String))}
      </div>
      {numberInput("maxMileage", "Max mileage (km)", "100000")}
      {select("town", "Location", TOWN_NAMES)}
      {select("bodyType", "Body type", BODY_TYPES, LABELS.bodyType)}
      {select("transmission", "Transmission", TRANSMISSIONS, LABELS.transmission)}
      {select("fuelType", "Fuel", FUEL_TYPES, LABELS.fuelType)}
      {select("condition", "Condition", CONDITIONS, LABELS.condition)}
      {select("importStatus", "Availability", IMPORT_STATUSES, LABELS.importStatus)}
    </div>
  );
}

export function SearchFilters({ makes }: { makes: Category[] }) {
  const { clear, pending } = useUrlFilters();
  return (
    <aside className="hidden lg:block" aria-label="Filters">
      <div className="sticky top-20 rounded-lg border border-border bg-white p-4 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold">Filters</p>
          <button className="text-xs font-semibold text-accent hover:underline" onClick={clear}>
            Clear all
          </button>
        </div>
        <div className={pending ? "opacity-60" : undefined}>
          <FilterFields makes={makes} />
        </div>
      </div>
    </aside>
  );
}

export function MobileFilters({ makes, activeCount }: { makes: Category[]; activeCount: number }) {
  const [open, setOpen] = useState(false);
  const { clear } = useUrlFilters();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal /> Filters{activeCount ? ` (${activeCount})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent title="Filters" side="right">
        <FilterFields makes={makes} />
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={clear}>
            <X /> Clear
          </Button>
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Show results
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SortSelect() {
  const { params, set } = useUrlFilters();
  return (
    <Select aria-label="Sort by" className="w-auto min-w-44" value={params.get("sort") ?? "recommended"} onChange={(e) => set({ sort: e.target.value === "recommended" ? undefined : e.target.value })}>
      {VEHICLE_SORTS.map((s) => (
        <option key={s} value={s}>
          {LABELS.sort[s]}
        </option>
      ))}
    </Select>
  );
}
