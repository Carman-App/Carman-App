"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatEngine, formatKes, formatMileage, label, LABELS, REPORT_REASON_LABELS, VEHICLE_STATUSES, type ModerationAction, type Report, type Vehicle, type VehicleStatus } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { api, apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { formatDate, relativeTime } from "@/lib/utils";
import { AdminTable } from "./admin-table";

type AdminVehicle = Vehicle & { flagged: boolean; flagReasons: string[] };
type Detail = AdminVehicle & { reports: Report[]; possibleDuplicates: { id: string; title: string; slug: string; status: string; price: number; image?: string }[] };

const ACTIONS: Record<ModerationAction, { label: string; variant: "primary" | "outline" | "danger" | "secondary"; from: VehicleStatus[]; needsReason: boolean }> = {
  APPROVE: { label: "Approve", variant: "primary", from: ["PENDING_REVIEW"], needsReason: false },
  REQUEST_CHANGES: { label: "Request changes", variant: "outline", from: ["PENDING_REVIEW", "ACTIVE"], needsReason: true },
  REJECT: { label: "Reject", variant: "outline", from: ["PENDING_REVIEW", "ACTIVE"], needsReason: true },
  SUSPEND: { label: "Suspend", variant: "danger", from: ["ACTIVE", "PENDING_REVIEW", "SOLD"], needsReason: true },
  REINSTATE: { label: "Reinstate", variant: "secondary", from: ["SUSPENDED"], needsReason: false },
};

function ModerationDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "vehicle", id], queryFn: () => api<Detail>(`/admin/vehicles/${id}`) });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const v = q.data;

  async function run(key: string, path: string, body: object, success: string) {
    setBusy(key);
    try {
      await api(path, { method: "POST", body });
      toast.success(success);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={v?.title ?? "Listing"} side="right" className="max-w-2xl">
        {!v ? <Skeleton className="h-96" /> : (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{LABELS.status[v.status]}</Badge>
              {v.flagged && v.flagReasons.map((r) => <Badge key={r} tone="danger">{r.replace("_", " ").toLowerCase()}</Badge>)}
              {v.isVerified && <Badge tone="success">Verified listing</Badge>}
              {v.isFeatured && <Badge tone="dark">Featured</Badge>}
              <Link href={`/vehicles/${v.slug}`} target="_blank" className="ml-auto text-xs font-semibold text-accent hover:underline">Open public page</Link>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {v.images.map((img) => <div key={img.publicId} className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md bg-surface"><Image src={img.url} alt="" fill sizes="128px" className="object-cover" /></div>)}
              {!v.images.length && <p className="text-danger">No photos</p>}
            </div>
            <p className="text-xl font-extrabold text-accent tabular">{v.price ? formatKes(v.price) : "No price"}</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[["Mileage", formatMileage(v.mileage)], ["Transmission", label("transmission", v.transmission)], ["Fuel", label("fuelType", v.fuelType)], ["Engine", formatEngine(v.engineCapacity)], ["Body", label("bodyType", v.bodyType)], ["Condition", label("condition", v.condition)], ["Location", v.location.town], ["Colour", v.color], ["Availability", label("importStatus", v.importStatus)]].map(([k, val]) => (
                <div key={k}><dt className="text-xs text-ink-muted">{k}</dt><dd className="font-medium">{val || "—"}</dd></div>
              ))}
            </dl>
            <p className="whitespace-pre-line text-ink-muted">{v.description || "No description"}</p>
            {v.seller && <p>Seller: <Link className="font-semibold hover:underline" href={`/${v.seller.type === "DEALER" ? "dealers" : "brokers"}/${v.seller.slug}`} target="_blank">{v.seller.name}</Link> {v.seller.isVerified ? <Badge tone="info">verified</Badge> : <Badge>unverified</Badge>} · {v.seller.phone}</p>}

            {v.possibleDuplicates.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning-soft p-3">
                <p className="font-semibold">Possible duplicates</p>
                <ul className="mt-1 space-y-1">{v.possibleDuplicates.map((d) => <li key={d.id}><Link className="hover:underline" href={`/vehicles/${d.slug}`} target="_blank">{d.title}</Link> · {formatKes(d.price)} · {d.status.toLowerCase()}</li>)}</ul>
              </div>
            )}
            {v.reports.length > 0 && (
              <div className="rounded-md border border-danger/20 bg-danger-soft p-3">
                <p className="font-semibold">{v.reports.length} report(s)</p>
                <ul className="mt-1 space-y-1">{v.reports.map((r) => <li key={r.id}>{REPORT_REASON_LABELS[r.reason]} · {r.status.toLowerCase()}{r.details ? ` — “${r.details}”` : ""}</li>)}</ul>
              </div>
            )}

            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="font-semibold">Decision</p>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason shown to the seller (required for reject, changes and suspend)" aria-label="Reason" />
              <div className="flex flex-wrap gap-2">
                {(Object.keys(ACTIONS) as ModerationAction[]).filter((a) => ACTIONS[a].from.includes(v.status)).map((a) => (
                  <Button key={a} size="sm" variant={ACTIONS[a].variant} loading={busy === a} disabled={ACTIONS[a].needsReason && reason.trim().length < 5} onClick={() => run(a, `/admin/vehicles/${v.id}/moderate`, { action: a, reason: reason || undefined }, `${ACTIONS[a].label}d`)}>
                    {ACTIONS[a].label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
              <div className="grid gap-1"><span className="text-xs text-ink-muted">Feature for days</span><Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24" /></div>
              <Button size="sm" variant="outline" disabled={v.status !== "ACTIVE"} loading={busy === "feature"} onClick={() => run("feature", `/admin/vehicles/${v.id}/feature`, { featured: !v.isFeatured, days }, v.isFeatured ? "Unfeatured" : "Featured")}>{v.isFeatured ? "Unfeature" : "Feature"}</Button>
              <Button size="sm" variant="outline" loading={busy === "verify"} onClick={() => run("verify", `/admin/vehicles/${v.id}/verify`, { verified: !v.isVerified }, v.isVerified ? "Verification removed" : "Listing verified")}>{v.isVerified ? "Remove listing verification" : "Mark listing verified"}</Button>
            </div>
            <div>
              <p className="mb-1 font-semibold">History</p>
              <ol className="space-y-1 text-xs text-ink-muted">{v.moderationHistory?.slice().reverse().map((h, i) => <li key={i}>{formatDate(h.at, true)} · {h.action.replace("_", " ").toLowerCase()}{h.reason ? ` — ${h.reason}` : ""}</li>)}</ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AdminVehicles({ fixedStatus }: { fixedStatus?: VehicleStatus }) {
  const [status, setStatus] = useState<string>(fixedStatus ?? "");
  const [flagged, setFlagged] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin", "vehicles", status, flagged, q, page],
    queryFn: () => apiPaged<AdminVehicle[]>(`/admin/vehicles?page=${page}&limit=25${status ? `&status=${status}` : ""}${flagged ? `&flagged=${flagged}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });
  return (
    <div>
      <PageHeader
        title={fixedStatus === "PENDING_REVIEW" ? "Pending listings" : "Vehicles"}
        description={fixedStatus === "PENDING_REVIEW" ? "Oldest first; flagged listings at the top." : undefined}
        actions={
          <>
            <Input placeholder="Search title" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="w-48" aria-label="Search" />
            {!fixedStatus && (
              <Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-40">
                <option value="">All statuses</option>
                {VEHICLE_STATUSES.map((s) => <option key={s} value={s}>{LABELS.status[s]}</option>)}
              </Select>
            )}
            <Select aria-label="Flagged" value={flagged} onChange={(e) => (setFlagged(e.target.value), setPage(1))} className="w-36"><option value="">Any</option><option value="true">Flagged</option></Select>
          </>
        }
      />
      <AdminTable
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        rows={query.data?.data}
        page={page}
        totalPages={query.data?.meta.totalPages}
        onPage={setPage}
        empty={fixedStatus ? "No listings waiting for review" : "No vehicles"}
        onRowClick={(r) => setOpen(r.id)}
        columns={[
          { key: "title", header: "Listing", cell: (r) => <span className="font-medium">{r.title}</span> },
          { key: "seller", header: "Seller", cell: (r) => r.seller?.name ?? "—" },
          { key: "price", header: "Price", cell: (r) => (r.price ? formatKes(r.price) : "—"), className: "tabular" },
          { key: "status", header: "Status", cell: (r) => <span className="flex flex-wrap gap-1"><Badge>{LABELS.status[r.status]}</Badge>{r.flagged && <Badge tone="danger">flagged</Badge>}</span> },
          { key: "updated", header: "Updated", cell: (r) => relativeTime(r.updatedAt) },
        ]}
      />
      {open && <ModerationDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
