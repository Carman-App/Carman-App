"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatKes, LABELS, type AdminOverview, type VehicleStatus } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Select } from "@/components/ui/input";
import { ErrorState, Skeleton } from "@/components/ui/misc";
import { SeriesChart } from "@/features/admin/charts";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

type Data = AdminOverview & { topMakes: { make: string; listings: number; views: number }[]; topTowns: { town: string; listings: number }[]; listingsByStatus: Record<string, number> };

function Ranked({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="h-64" role="img" aria-label={title}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={110} fontSize={12} stroke="#5B6068" />
            <Tooltip />
            <Bar dataKey="value" fill="#C2410C" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(90);
  const q = useQuery({ queryKey: ["admin", "analytics", days], queryFn: () => api<Data>(`/admin/analytics?days=${days}`) });
  const d = q.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" actions={<Select aria-label="Range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-36"><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>12 months</option></Select>} />
      {q.isLoading ? <Skeleton className="h-96" /> : !d ? <ErrorState message={errorMessage(q.error)} /> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <SeriesChart title="Listings published" data={d.series} dataKey="listings" color="#C2410C" kind="bar" />
            <SeriesChart title="Registrations" data={d.series} dataKey="registrations" color="#1D4ED8" />
            <SeriesChart title="Vehicle views" data={d.series} dataKey="views" />
            <SeriesChart title="Revenue" data={d.series} dataKey="revenueKes" color="#15803D" kind="bar" format={formatKes} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Ranked title="Top makes (active listings)" rows={d.topMakes.map((m) => ({ label: m.make, value: m.listings }))} />
            <Ranked title="Top towns" rows={d.topTowns.map((t) => ({ label: t.town, value: t.listings }))} />
            <Ranked title="Listings by status" rows={Object.entries(d.listingsByStatus).map(([s, n]) => ({ label: LABELS.status[s as VehicleStatus] ?? s, value: n }))} />
          </div>
        </>
      )}
    </div>
  );
}
