"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatKes, type AdminOverview } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Select } from "@/components/ui/input";
import { ErrorState, Skeleton, Stat } from "@/components/ui/misc";
import { SeriesChart } from "@/features/admin/charts";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

export default function AdminOverviewPage() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["admin", "overview", days], queryFn: () => api<AdminOverview>(`/admin/overview?days=${days}`) });
  const t = q.data?.totals;
  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" actions={<Select aria-label="Range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-36"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></Select>} />
      {q.isLoading ? <Skeleton className="h-96" /> : q.error || !t ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total users" value={t.users.toLocaleString("en-KE")} hint={`${t.buyers} buyers`} />
            <Stat label="Brokers" value={t.brokers} />
            <Stat label="Dealers" value={t.dealers} />
            <Stat label="Active listings" value={t.activeListings} />
            <Stat label="Pending listings" value={t.pendingListings} />
            <Stat label="Sold vehicles" value={t.soldVehicles} />
            <Stat label="Total inquiries" value={t.inquiries} />
            <Stat label="Revenue this month" value={formatKes(t.revenueThisMonthKes)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <SeriesChart title="Listings published" data={q.data!.series} dataKey="listings" color="#C2410C" kind="bar" />
            <SeriesChart title="New registrations" data={q.data!.series} dataKey="registrations" color="#1D4ED8" />
            <SeriesChart title="Vehicle views" data={q.data!.series} dataKey="views" />
            <SeriesChart title="Buyer inquiries" data={q.data!.series} dataKey="inquiries" color="#1FA855" kind="bar" />
            <SeriesChart title="Revenue (KES)" data={q.data!.series} dataKey="revenueKes" color="#15803D" kind="bar" format={formatKes} />
          </div>
        </>
      )}
    </div>
  );
}
