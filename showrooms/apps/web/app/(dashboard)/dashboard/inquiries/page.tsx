"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { formatKes, INQUIRY_STATUSES, whatsappLink, type Inquiry, type InquiryStatus } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Pagination, Skeleton } from "@/components/ui/misc";
import { isSeller, useAuth } from "@/features/auth/auth-provider";
import { api, apiPaged } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";
import { formatDate, relativeTime } from "@/lib/utils";

const STATUS_LABEL: Record<InquiryStatus, string> = { NEW: "New", CONTACTED: "Contacted", SCHEDULED: "Viewing scheduled", CLOSED: "Closed", SPAM: "Spam" };

export default function InquiriesPage() {
  const { user } = useAuth();
  const seller = isSeller(user);
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const path = seller ? "/broker/inquiries" : "/inquiries/me";
  const q = useQuery({ queryKey: ["inquiries", path, status, page], queryFn: () => apiPaged<Inquiry[]>(`${path}?page=${page}&limit=20${status ? `&status=${status}` : ""}`) });

  async function setLead(l: Inquiry, next: InquiryStatus) {
    try {
      await api(`/broker/inquiries/${l.id}`, { method: "PATCH", body: { status: next } });
      qc.invalidateQueries({ queryKey: ["inquiries"] });
      toast.success(`Marked ${STATUS_LABEL[next].toLowerCase()}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) toast.error("Lead tracking is a Pro feature", { action: { label: "Upgrade", onClick: () => router.push("/dashboard/subscription") } });
      else toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={seller ? "Leads" : "My inquiries"}
        description={seller ? "Viewing requests and questions from buyers." : "Viewing requests and questions you've sent."}
        actions={
          <Select aria-label="Filter by status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-44">
            <option value="">All statuses</option>
            {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        }
      />
      {q.isLoading ? (
        <Skeleton className="h-64" />
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.data.length ? (
        <EmptyState title="Nothing here yet" description={seller ? "When buyers request a viewing or ask a question, it shows up here and you get a notification." : "Request a viewing from any listing to see it here."} />
      ) : (
        <ul className="grid gap-3">
          {q.data.data.map((l) => (
            <li key={l.id} className="rounded-lg border border-border bg-white p-4 shadow-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={l.type === "VIEWING_REQUEST" ? "accent" : "info"}>{l.type === "VIEWING_REQUEST" ? "Viewing request" : "Question"}</Badge>
                    <Badge tone={l.status === "NEW" ? "warning" : "neutral"}>{STATUS_LABEL[l.status]}</Badge>
                    <span className="text-xs text-ink-subtle">{relativeTime(l.createdAt)}</span>
                  </div>
                  {l.vehicle && (
                    <p className="text-sm">
                      <Link href={`/vehicles/${l.vehicle.slug}`} className="font-semibold hover:underline">{l.vehicle.title}</Link> · <span className="text-accent tabular">{formatKes(l.vehicle.price)}</span>
                    </p>
                  )}
                  {seller && l.buyer && <p className="text-sm"><strong>{l.buyer.name}</strong>{l.buyer.phone ? ` · ${l.buyer.phone}` : ""}</p>}
                  {l.preferredDate && <p className="flex items-center gap-1 text-sm text-ink-muted"><CalendarCheck className="size-4" /> Preferred: {formatDate(l.preferredDate)}</p>}
                  {l.message && <p className="text-sm text-ink-muted">&ldquo;{l.message}&rdquo;</p>}
                </div>
                {seller && (
                  <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                    {l.buyer?.phone && l.vehicle && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="whatsapp" asChild>
                          <a href={whatsappLink(l.buyer.phone, `Hi ${l.buyer.name.split(" ")[0]}, thanks for your interest in the ${l.vehicle.title}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Reply</a>
                        </Button>
                        <Button size="sm" variant="outline" asChild><a href={`tel:${l.buyer.phone}`}><Phone /> Call</a></Button>
                      </div>
                    )}
                    <Select aria-label="Lead status" value={l.status} onChange={(e) => setLead(l, e.target.value as InquiryStatus)} className="h-8 w-44 text-xs">
                      {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </Select>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.data && <Pagination page={page} totalPages={q.data.meta.totalPages} onPage={setPage} />}
    </div>
  );
}
