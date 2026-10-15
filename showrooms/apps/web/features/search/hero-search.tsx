"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { TOWN_NAMES, type Category } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

const PRICE_STEPS = [300_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 8_000_000, 12_000_000];
const shortKes = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}K`);

/** A plain GET form, so search works before JavaScript loads on slow connections. */
export function HeroSearch({ makes }: { makes: Category[] }) {
  const [make, setMake] = useState("");
  const models = makes.find((m) => m.name === make)?.models ?? [];
  return (
    <form action="/vehicles" method="get" className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-raised sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_auto]" role="search" aria-label="Find a car">
      <Select name="make" aria-label="Make" value={make} onChange={(e) => setMake(e.target.value)}>
        <option value="">Any make</option>
        {makes.map((m) => (
          <option key={m.id} value={m.name}>
            {m.name}
          </option>
        ))}
      </Select>
      {models.length ? (
        <Select name="model" aria-label="Model" defaultValue="">
          <option value="">Any model</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      ) : (
        <Input name="model" placeholder="Model, e.g. Fielder" aria-label="Model" />
      )}
      <Select name="minPrice" aria-label="Minimum price" defaultValue="">
        <option value="">Min price</option>
        {PRICE_STEPS.map((p) => (
          <option key={p} value={p}>KES {shortKes(p)}</option>
        ))}
      </Select>
      <Select name="maxPrice" aria-label="Maximum price" defaultValue="">
        <option value="">Max price</option>
        {PRICE_STEPS.map((p) => (
          <option key={p} value={p}>KES {shortKes(p)}</option>
        ))}
      </Select>
      <Select name="town" aria-label="Location" defaultValue="">
        <option value="">All of Kenya</option>
        {TOWN_NAMES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </Select>
      <Button type="submit" size="md" className="sm:col-span-2 lg:col-span-1">
        <Search /> Search
      </Button>
    </form>
  );
}
