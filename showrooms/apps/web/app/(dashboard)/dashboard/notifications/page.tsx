"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import type { Notification } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, Pagination, Skeleton } from "@/components/ui/misc";
import { api, apiPaged } from "@/lib/api-client";
import { cn, relativeTime } from "@/lib/utils";

function linkFor(n: Notification): string | undefined {
  const d = n.data ?? {};
  if (d.screen === "leads" || d.inquiryId) return "/dashboard/inquiries";
  if (d.screen === "billing" || d.paymentId) return "/dashboard/payments";
  if (d.screen === "verification") return "/dashboard/profile#verification";
  if (d.vehicleId && d.screen === "my-vehicles") return `/dashboard/vehicles/${d.vehicleId}`;
  if (d.slug) return `/vehicles/${d.slug}`;
  return undefined;
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["notifications", page], queryFn: () => apiPaged<Notification[], { unread: number }>(`/notifications?page=${page}`) });
  async function readAll() {
    await api("/notifications/read-all", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }
  async function read(n: Notification) {
    if (!n.readAt) {
      await api(`/notifications/${n.id}/read`, { method: "PATCH" });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  }
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" actions={q.data?.meta.unread ? <Button variant="outline" size="sm" onClick={readAll}>Mark all read</Button> : undefined} />
      {q.isLoading ? <Skeleton className="h-64" /> : !q.data?.data.length ? <EmptyState icon={<Bell className="size-6" />} title="You're all caught up" /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {q.data.data.map((n) => {
            const href = linkFor(n);
            const body = (
              <div className={cn("flex gap-3 p-4", !n.readAt && "bg-accent-soft/50")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-sm text-ink-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-subtle">{relativeTime(n.createdAt)}</p>
                </div>
              </div>
            );
            return <li key={n.id} onClick={() => read(n)}>{href ? <Link href={href}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
      {q.data && <Pagination page={page} totalPages={q.data.meta.totalPages} onPage={setPage} />}
    </div>
  );
}
