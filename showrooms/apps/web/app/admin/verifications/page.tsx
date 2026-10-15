"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Lock } from "lucide-react";
import { toast } from "sonner";
import { VERIFICATION_STATUSES } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { AdminTable } from "@/features/admin/admin-table";
import { api, apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { formatDate, relativeTime } from "@/lib/utils";

interface Row { id: string; subjectType: string; status: string; fullName: string; idType: string; businessName?: string; documentCount: number; user?: { name: string; email: string }; createdAt: string }
interface Detail { id: string; subjectType: string; status: string; fullName: string; idType: string; idNumber: string; kraPin?: string; businessName?: string; businessRegNumber?: string; reviewNotes?: string; createdAt: string; documents: { kind: string; url?: string }[]; user?: { name: string; email: string; phone?: string; memberSince: string }; profile?: { slug: string; name: string } }

function Review({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "verification", id], queryFn: () => api<Detail>(`/admin/verifications/${id}`), staleTime: 0, gcTime: 0 });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const d = q.data;
  async function decide(decision: "APPROVE" | "REJECT" | "REQUEST_INFO") {
    setBusy(decision);
    try {
      await api(`/admin/verifications/${id}/decision`, { method: "POST", body: { decision, notes: notes || undefined } });
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Verification request" side="right" description="Viewing this record is logged. Document links expire in 10 minutes.">
        {!d ? <Skeleton className="h-80" /> : (
          <div className="space-y-4 text-sm">
            <p className="flex items-center gap-2 rounded-md bg-surface p-2 text-xs text-ink-muted"><Lock className="size-4" /> Confidential. Don&apos;t copy or share these details.</p>
            <dl className="grid grid-cols-2 gap-3">
              {[["Type", d.subjectType.toLowerCase()], ["Status", d.status.toLowerCase()], ["Full name", d.fullName], ["ID type", d.idType.replace("_", " ").toLowerCase()], ["ID number", d.idNumber], ["KRA PIN", d.kraPin ?? "—"], ["Business", d.businessName ?? "—"], ["Reg. number", d.businessRegNumber ?? "—"], ["Account", `${d.user?.name} · ${d.user?.email}`], ["Phone", d.user?.phone ?? "—"], ["Member since", formatDate(d.user?.memberSince)], ["Submitted", formatDate(d.createdAt, true)]].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-ink-muted">{k}</dt><dd className="font-medium break-all">{v}</dd></div>
              ))}
            </dl>
            {d.profile && <Link href={`/${d.subjectType === "DEALER" ? "dealers" : "brokers"}/${d.profile.slug}`} target="_blank" className="text-accent hover:underline">Open showroom: {d.profile.name}</Link>}
            <ul className="grid gap-2">
              {d.documents.map((doc, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-border p-2">
                  <span className="flex items-center gap-2"><FileText className="size-4" /> {doc.kind.replace(/_/g, " ").toLowerCase()}</span>
                  {doc.url ? <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent">Open</a> : <span className="text-xs text-ink-subtle">Media storage not configured</span>}
                </li>
              ))}
            </ul>
            {(d.status === "PENDING" || d.status === "INFO_REQUESTED") && (
              <div className="space-y-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes to the seller (required to reject or request info)" aria-label="Notes" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => decide("APPROVE")} loading={busy === "APPROVE"}>Approve</Button>
                  <Button variant="outline" onClick={() => decide("REQUEST_INFO")} loading={busy === "REQUEST_INFO"} disabled={notes.length < 5}>Request info</Button>
                  <Button variant="danger" onClick={() => decide("REJECT")} loading={busy === "REJECT"} disabled={notes.length < 5}>Reject</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function VerificationsPage() {
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "verifications", status, page], queryFn: () => apiPaged<Row[]>(`/admin/verifications?page=${page}${status ? `&status=${status}` : ""}`) });
  return (
    <div>
      <PageHeader title="Verifications" description="Identity and business checks for brokers and dealers." actions={<Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-44"><option value="">All</option>{VERIFICATION_STATUSES.filter((s) => s !== "UNVERIFIED").map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</Select>} />
      <AdminTable
        loading={q.isLoading}
        error={q.error}
        rows={q.data?.data}
        page={page}
        totalPages={q.data?.meta.totalPages}
        onPage={setPage}
        empty="No requests"
        onRowClick={(r) => setOpen(r.id)}
        columns={[
          { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.fullName}</span> },
          { key: "type", header: "Type", cell: (r) => <Badge>{r.subjectType.toLowerCase()}</Badge> },
          { key: "account", header: "Account", cell: (r) => r.user?.email ?? "—" },
          { key: "docs", header: "Docs", cell: (r) => r.documentCount },
          { key: "status", header: "Status", cell: (r) => <Badge tone={r.status === "VERIFIED" ? "success" : r.status === "PENDING" ? "info" : "warning"}>{r.status.replace("_", " ").toLowerCase()}</Badge> },
          { key: "submitted", header: "Submitted", cell: (r) => relativeTime(r.createdAt) },
        ]}
      />
      {open && <Review id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
