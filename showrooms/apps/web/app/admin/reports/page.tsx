"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { REPORT_REASON_LABELS, REPORT_STATUSES, type Report } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { AdminTable } from "@/features/admin/admin-table";
import { api, apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { relativeTime } from "@/lib/utils";

type Row = Report & { vehicle?: { id: string; title: string; slug: string; status: string }; reporter?: { name: string; email: string } };

export default function ReportsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["admin", "reports", status, page], queryFn: () => apiPaged<Row[]>(`/admin/reports?page=${page}${status ? `&status=${status}` : ""}`) });

  async function resolve(r: Row, next: "RESOLVED" | "DISMISSED", suspendVehicle = false) {
    const resolution = prompt(next === "DISMISSED" ? "Why dismiss?" : "What did you find?") ?? undefined;
    if (resolution === undefined) return;
    try {
      await api(`/admin/reports/${r.id}`, { method: "PATCH", body: { status: next, resolution, suspendVehicle } });
      toast.success(suspendVehicle ? "Resolved and listing suspended" : "Updated");
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  return (
    <div>
      <PageHeader title="Reports" description="Listings reported by buyers." actions={<Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-40"><option value="">All</option>{REPORT_STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</Select>} />
      <AdminTable
        loading={q.isLoading}
        error={q.error}
        rows={q.data?.data}
        page={page}
        totalPages={q.data?.meta.totalPages}
        onPage={setPage}
        empty="No reports"
        columns={[
          { key: "vehicle", header: "Listing", cell: (r) => (r.vehicle ? <Link href={`/vehicles/${r.vehicle.slug}`} target="_blank" className="font-medium hover:underline">{r.vehicle.title}</Link> : "—") },
          { key: "reason", header: "Reason", cell: (r) => <span><Badge tone="danger">{REPORT_REASON_LABELS[r.reason]}</Badge>{r.details && <span className="mt-1 block text-xs text-ink-muted">{r.details}</span>}</span> },
          { key: "reporter", header: "Reporter", cell: (r) => r.reporter?.email ?? "—" },
          { key: "status", header: "Status", cell: (r) => <Badge>{r.status.toLowerCase()}</Badge> },
          { key: "when", header: "When", cell: (r) => relativeTime(r.createdAt) },
          {
            key: "actions",
            header: "",
            cell: (r) =>
              r.status === "OPEN" || r.status === "REVIEWING" ? (
                <span className="flex flex-wrap gap-1">
                  <Button size="sm" variant="danger" onClick={() => resolve(r, "RESOLVED", true)}>Suspend listing</Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(r, "RESOLVED")}>Resolve</Button>
                  <Button size="sm" variant="ghost" onClick={() => resolve(r, "DISMISSED")}>Dismiss</Button>
                </span>
              ) : (
                <span className="text-xs text-ink-muted">{r.resolution}</span>
              ),
          },
        ]}
      />
    </div>
  );
}
