import { VehicleCardSkeleton } from "@/components/vehicles/vehicle-card";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-surface" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <VehicleCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
