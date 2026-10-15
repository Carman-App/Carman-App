import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { TOWN_NAMES } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { VerifiedSellerBadge } from "@/components/vehicles/badges";

export interface DirectoryItem {
  id: string;
  slug: string;
  name: string;
  town?: string;
  verified: boolean;
  activeListingCount: number;
  ratingAvg: number;
  ratingCount: number;
  blurb?: string;
}

export function Directory({ kind, title, intro, items, q, town, verified, page, totalPages }: { kind: "brokers" | "dealers"; title: string; intro: string; items: DirectoryItem[]; q?: string; town?: string; verified?: string; page: number; totalPages: number }) {
  const href = (p: number) => `/${kind}?${new URLSearchParams(Object.entries({ q, town, verified, page: String(p) }).filter(([, v]) => v) as [string, string][]).toString()}`;
  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-ink-muted">{intro}</p>
      <form className="mt-6 grid gap-2 sm:grid-cols-[1fr_200px_180px_auto]" role="search">
        <Input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search by name" />
        <Select name="town" defaultValue={town ?? ""} aria-label="Town">
          <option value="">All towns</option>
          {TOWN_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select name="verified" defaultValue={verified ?? ""} aria-label="Verification">
          <option value="">All</option>
          <option value="true">Verified only</option>
        </Select>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <Link key={b.id} href={`/${kind}/${b.slug}`} className="rounded-lg border border-border bg-white p-5 shadow-card hover:border-ink">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-ink text-lg font-bold text-white">{b.name[0]}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{b.name}</p>
                <p className="flex items-center gap-1 text-sm text-ink-muted">{b.town && <><MapPin className="size-3.5" /> {b.town} · </>}{b.activeListingCount} cars</p>
              </div>
            </div>
            {b.blurb && <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{b.blurb}</p>}
            <div className="mt-3 flex items-center gap-2">
              {b.verified && <VerifiedSellerBadge compact />}
              {b.ratingCount > 0 && <span className="flex items-center gap-1 text-xs text-ink-muted"><Star className="size-3.5 fill-amber-400 text-amber-400" /> {b.ratingAvg.toFixed(1)}</span>}
            </div>
          </Link>
        ))}
      </div>
      {!items.length && <EmptyState title={`No ${kind} found`} description="Try another town or clear the search." />}
      <Pagination page={page} totalPages={totalPages} hrefFor={href} />
    </div>
  );
}
