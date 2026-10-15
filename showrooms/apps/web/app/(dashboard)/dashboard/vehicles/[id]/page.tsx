"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { LABELS, type Vehicle } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/features/auth/auth-provider";
import { sellerName, useSellerProfile } from "@/features/dashboard/use-seller";
import { BoostDialog } from "@/features/listings/boost-dialog";
import { VehicleEditor } from "@/features/listings/vehicle-editor";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

export default function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const profile = useSellerProfile();
  const vehicle = useQuery({ queryKey: ["vehicle", id], queryFn: () => api<Vehicle>(`/vehicles/${id}`) });

  if (vehicle.isLoading) return <Skeleton className="h-96 w-full" />;
  if (vehicle.error || !vehicle.data) return <ErrorState message={errorMessage(vehicle.error)} onRetry={() => vehicle.refetch()} />;
  const v = vehicle.data;
  return (
    <div className="max-w-5xl">
      <PageHeader
        title={v.title}
        description={v.stats ? `${v.stats.views} views · ${v.stats.whatsappClicks} WhatsApp taps · ${v.stats.inquiries} inquiries` : undefined}
        actions={
          <>
            <Badge tone={v.status === "ACTIVE" ? "success" : v.status === "REJECTED" ? "warning" : "neutral"}>{LABELS.status[v.status]}</Badge>
            {v.status === "ACTIVE" && (
              <>
                <BoostDialog vehicle={v} />
                <Button variant="outline" asChild><Link href={`/vehicles/${v.slug}`} target="_blank"><ExternalLink /> View live</Link></Button>
              </>
            )}
          </>
        }
      />
      <VehicleEditor key={v.updatedAt} initial={v} sellerName={sellerName(profile.data, user?.name)} />
    </div>
  );
}
