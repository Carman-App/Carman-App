"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LABELS, type SellerAnalytics } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ErrorState, Skeleton, Stat } from "@/components/ui/misc";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["analytics", days], queryFn: () => api<SellerAnalytics>(`/analytics/seller?days=${days}`) });
  const a = q.data;
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="WhatsApp and call taps show buyer intent. They are not confirmed conversations or sales."
        actions={
          <Select aria-label="Date range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-36">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        }
      />
      {q.isLoading ? <Skeleton className="h-96" /> : q.error || !a ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Listing views" value={a.totals.views.toLocaleString("en-KE")} />
            <Stat label="WhatsApp taps" value={a.totals.whatsappClicks} />
            <Stat label="Call taps" value={a.totals.callClicks} />
            <Stat label="Viewing requests" value={a.totals.viewingRequests} />
            <Stat label="Questions" value={a.totals.questions} />
          </div>
          {a.series ? (
            <div className="rounded-lg border border-border bg-white p-4 shadow-card">
              <p className="mb-3 font-semibold">Daily activity</p>
              <div className="h-72" role="img" aria-label="Daily views, WhatsApp taps, call taps and inquiries">
                <ResponsiveContainer>
                  <LineChart data={a.series} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid stroke="#E6E6E3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={12} stroke="#8A8F96" />
                    <YAxis allowDecimals={false} fontSize={12} stroke="#8A8F96" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="views" name="Views" stroke="#1C1F23" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="whatsappClicks" name="WhatsApp taps" stroke="#1FA855" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="callClicks" name="Call taps" stroke="#1D4ED8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="inquiries" name="Inquiries" stroke="#C2410C" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm"><strong>Daily trends are a Pro feature.</strong> See which days buyers are most active and when to post to your Status.</p>
              <Button size="sm" asChild><Link href="/dashboard/subscription">Upgrade</Link></Button>
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Performance per listing</caption>
              <thead className="bg-surface text-left text-xs tracking-wide text-ink-muted uppercase">
                <tr><th className="p-3">Listing</th><th className="p-3">Status</th><th className="p-3 text-right">Views</th><th className="p-3 text-right">WhatsApp</th><th className="p-3 text-right">Calls</th><th className="p-3 text-right">Inquiries</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {a.perVehicle?.map((v, i) => (
                  <tr key={v.id}>
                    <td className="p-3"><Link href={`/dashboard/vehicles/${v.id}`} className="font-medium hover:underline">{v.title}</Link>{i < 3 && v.views > 0 && <Badge tone="accent" className="ml-2">Top</Badge>}</td>
                    <td className="p-3"><Badge>{LABELS.status[v.status]}</Badge></td>
                    <td className="p-3 text-right tabular">{v.views}</td>
                    <td className="p-3 text-right tabular">{v.whatsappClicks}</td>
                    <td className="p-3 text-right tabular">{v.callClicks}</td>
                    <td className="p-3 text-right tabular">{v.inquiries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
