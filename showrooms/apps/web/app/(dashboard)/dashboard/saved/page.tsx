"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Vehicle } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Pagination } from "@/components/ui/misc";
import { VehicleCardSkeleton, VehicleGrid } from "@/components/vehicles/vehicle-card";
import { apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

export default function SavedPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["favorites", "list", page], queryFn: () => apiPaged<Vehicle[]>(`/favorites?page=${page}&limit=24`) });
  return (
    <div>
      <PageHeader title="Saved vehicles" />
      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <VehicleCardSkeleton key={i} />)}</div>
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.data?.data.length ? (
        <>
          <VehicleGrid vehicles={q.data.data} className="xl:grid-cols-3" />
          <Pagination page={page} totalPages={q.data.meta.totalPages} onPage={setPage} />
        </>
      ) : (
        <EmptyState title="No saved vehicles" description="Tap the heart on a listing to keep it here." action={<Button asChild><Link href="/vehicles">Browse cars</Link></Button>} />
      )}
    </div>
  );
}
