import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { label, toQueryString, vehicleSearchSchema, type VehicleSearchParams } from "@showrooms/shared";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { VehicleGrid } from "@/components/vehicles/vehicle-card";
import { MobileFilters, SearchFilters, SortSelect } from "@/features/search/filters";
import { getCatalog, getVehicles } from "@/lib/catalog";

type SP = Promise<Record<string, string | string[] | undefined>>;

function parse(raw: Record<string, string | string[] | undefined>): VehicleSearchParams {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = vehicleSearchSchema.safeParse(flat);
  if (parsed.success) return parsed.data;
  // Drop invalid keys rather than failing the whole page.
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  return vehicleSearchSchema.parse(Object.fromEntries(Object.entries(flat).filter(([k]) => !bad.has(k))));
}

function headline(p: VehicleSearchParams): string {
  const what = [p.make, p.model].filter(Boolean).join(" ") || (p.bodyType ? label("bodyType", p.bodyType) + "s" : "Cars");
  return `${what} for sale${p.town ? ` in ${p.town}` : " in Kenya"}`;
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const p = parse(await searchParams);
  const title = headline(p);
  return {
    title,
    description: `${title}. Compare prices in KES, mileage and specs from verified brokers and dealers on Showrooms.`,
    alternates: { canonical: `/vehicles${p.make || p.town ? `?${toQueryString({ make: p.make, model: p.model, town: p.town })}` : ""}` },
  };
}

export default async function VehiclesPage({ searchParams }: { searchParams: SP }) {
  const p = parse(await searchParams);
  const query = toQueryString({ ...p, sort: p.sort === "recommended" ? undefined : p.sort });
  const [catalog, results] = await Promise.all([getCatalog(), getVehicles(query, 30)]);
  const activeCount = ["make", "model", "minPrice", "maxPrice", "minYear", "maxYear", "maxMileage", "town", "bodyType", "transmission", "fuelType", "condition", "importStatus"].filter((k) => p[k as keyof VehicleSearchParams] !== undefined).length;
  const hrefFor = (page: number) => `/vehicles?${toQueryString({ ...p, sort: p.sort === "recommended" ? undefined : p.sort, page, limit: undefined })}`;

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{headline(p)}</h1>
        <p className="mt-1 text-sm text-ink-muted">{results.meta.total.toLocaleString("en-KE")} vehicles</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Suspense>
          <SearchFilters makes={catalog.makes} />
        </Suspense>
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Suspense>
              <MobileFilters makes={catalog.makes} activeCount={activeCount} />
            </Suspense>
            <div className="ml-auto">
              <Suspense>
                <SortSelect />
              </Suspense>
            </div>
          </div>
          {results.items.length ? (
            <>
              <VehicleGrid vehicles={results.items} className="xl:grid-cols-3" />
              <Pagination page={results.meta.page} totalPages={results.meta.totalPages} hrefFor={hrefFor} />
            </>
          ) : (
            <EmptyState
              title={results.ok ? "No vehicles match these filters" : "Listings are temporarily unavailable"}
              description={results.ok ? "Try widening your price range or removing a filter." : "Please try again in a moment."}
              action={
                <Link href="/vehicles" className="text-sm font-semibold text-accent hover:underline">
                  Clear filters
                </Link>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
