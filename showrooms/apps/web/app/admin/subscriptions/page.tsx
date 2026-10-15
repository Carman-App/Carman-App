"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatKes, PLAN_FEATURE_KEYS, SUBSCRIPTION_STATUSES, type Plan, type Subscription } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { AdminTable } from "@/features/admin/admin-table";
import { api, apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/utils";

type Row = Subscription & { user?: { name: string; email: string; role: string } };

function PlanEditor({ plan }: { plan: Plan }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ priceKes: plan.priceKes, listingLimit: plan.listingLimit, staffLimit: plan.staffLimit, periodDays: plan.periodDays, isActive: plan.isActive, features: plan.features });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(`/admin/plans/${plan.id}`, { method: "PATCH", body: draft });
      toast.success(`${plan.name} updated. New purchases use the new price.`);
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const num = (k: "priceKes" | "listingLimit" | "staffLimit" | "periodDays", label: string) => (
    <label className="grid gap-1 text-xs text-ink-muted">{label}<Input type="number" min={0} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} /></label>
  );
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2">{plan.name} <Badge>{plan.code}</Badge>{!draft.isActive && <Badge tone="warning">inactive</Badge>}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">{num("priceKes", "Price (KES)")}{num("periodDays", "Period (days)")}{num("listingLimit", "Listing limit")}{num("staffLimit", "Staff limit")}</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {PLAN_FEATURE_KEYS.map((f) => (
            <label key={f} className="flex items-center gap-1"><input type="checkbox" checked={draft.features[f]} onChange={(e) => setDraft({ ...draft, features: { ...draft.features, [f]: e.target.checked } })} /> {f}</label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Available for purchase</label>
        <Button size="sm" onClick={save} loading={busy}>Save {plan.name}</Button>
      </CardContent>
    </Card>
  );
}

export default function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const plans = useQuery({ queryKey: ["admin", "plans"], queryFn: () => api<Plan[]>("/admin/plans") });
  const subs = useQuery({ queryKey: ["admin", "subscriptions", status, page], queryFn: () => apiPaged<Row[]>(`/admin/subscriptions?page=${page}${status ? `&status=${status}` : ""}`) });
  async function cancel(s: Row) {
    const reason = prompt("Reason for cancelling");
    if (!reason) return;
    try {
      await api(`/admin/subscriptions/${s.id}/cancel`, { method: "POST", body: { reason } });
      qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Plans & pricing" description="Prices and limits live in the database; changes apply to new purchases immediately." />
        <div className="grid gap-4 lg:grid-cols-3">{plans.data?.map((p) => <PlanEditor key={p.id + p.priceKes} plan={p} />)}</div>
      </div>
      <div>
        <PageHeader title="Subscriptions" actions={<Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-44"><option value="">All</option>{SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</Select>} />
        <AdminTable
          loading={subs.isLoading}
          error={subs.error}
          rows={subs.data?.data}
          page={page}
          totalPages={subs.data?.meta.totalPages}
          onPage={setPage}
          columns={[
            { key: "user", header: "Account", cell: (s) => s.user?.email ?? "—" },
            { key: "plan", header: "Plan", cell: (s) => s.planName },
            { key: "price", header: "Price", cell: (s) => formatKes(s.priceKes) },
            { key: "status", header: "Status", cell: (s) => <Badge tone={s.status === "ACTIVE" ? "success" : "neutral"}>{s.status.replace("_", " ").toLowerCase()}</Badge> },
            { key: "ends", header: "Ends", cell: (s) => formatDate(s.endsAt) },
            { key: "actions", header: "", cell: (s) => (s.status === "ACTIVE" || s.status === "PENDING_PAYMENT" ? <Button size="sm" variant="outline" onClick={() => cancel(s)}>Cancel</Button> : null) },
          ]}
        />
      </div>
    </div>
  );
}
