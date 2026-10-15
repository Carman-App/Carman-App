import Image from "next/image";
import Link from "next/link";
import { Fuel, Gauge, MapPin, Settings2 } from "lucide-react";
import { formatKes, formatMileage, label, type Vehicle } from "@showrooms/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BoostedBadge, FeaturedBadge, VerifiedSellerBadge } from "./badges";
import { FavoriteButton } from "./favorite-button";

export function VehicleCard({ vehicle, priority, className }: { vehicle: Vehicle; priority?: boolean; className?: string }) {
  const image = vehicle.images[0];
  return (
    <article className={cn("group relative flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-card transition-shadow hover:shadow-raised", className)}>
      <div className="relative aspect-[4/3] bg-surface">
        {image ? (
          <Image
            src={image.url}
            alt={vehicle.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            preload={priority}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-subtle">No photo yet</div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {vehicle.isFeatured ? <FeaturedBadge /> : vehicle.isBoosted ? <BoostedBadge /> : null}
          {vehicle.status === "SOLD" && <Badge tone="danger">Sold</Badge>}
        </div>
        <FavoriteButton vehicleId={vehicle.id} initial={vehicle.isFavorite} className="absolute top-2 right-2" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 font-semibold text-ink">
          <Link href={`/vehicles/${vehicle.slug}`} className="after:absolute after:inset-0">
            {vehicle.title}
          </Link>
        </h3>
        <p className="tabular text-xl font-extrabold text-accent">{formatKes(vehicle.price)}</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-muted">
          <li className="flex items-center gap-1"><Gauge className="size-3.5" aria-hidden />{formatMileage(vehicle.mileage)}</li>
          <li className="flex items-center gap-1"><Settings2 className="size-3.5" aria-hidden />{label("transmission", vehicle.transmission)}</li>
          <li className="flex items-center gap-1"><Fuel className="size-3.5" aria-hidden />{label("fuelType", vehicle.fuelType)}</li>
          <li className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{vehicle.location.town}</li>
        </ul>
        {vehicle.seller && (
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
            <span className="truncate text-ink-muted">{vehicle.seller.name}</span>
            {vehicle.seller.isVerified && <VerifiedSellerBadge compact />}
          </div>
        )}
      </div>
    </article>
  );
}

export function VehicleGrid({ vehicles, className }: { vehicles: Vehicle[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {vehicles.map((v, i) => (
        <VehicleCard key={v.id} vehicle={v} priority={i < 4} />
      ))}
    </div>
  );
}

export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="aspect-[4/3] animate-pulse bg-surface" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-surface" />
        <div className="h-3 w-full animate-pulse rounded bg-surface" />
      </div>
    </div>
  );
}
