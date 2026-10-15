"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BadgeCheck, Eye, MessageCircle, MoreHorizontal, Pencil, PlusCircle, Share2 } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import { formatKes, LABELS, VEHICLE_STATUSES, type Vehicle, type VehicleStatus } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Pagination, Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/features/auth/auth-provider";
import { sellerName, useSellerProfile } from "@/features/dashboard/use-seller";
import { ShareDialog } from "@/features/listings/share-dialog";
import { apiPaged, api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { cn, relativeTime } from "@/lib/utils";

const TONE: Partial<Record<VehicleStatus, "success" | "warning" | "danger" | "info" | "neutral">> = { ACTIVE: "success", PENDING_REVIEW: "info", REJECTED: "warning", SUSPENDED: "danger", SOLD: "neutral" };

export default function MyVehiclesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const profile = useSellerProfile();
  const qc = useQueryClient();
  const [status, setStatus] = useState<VehicleStatus | "">("");
  const [page, setPage] = useState(1);
  const [sharing, setSharing] = useState<Vehicle | null>(null);
  const q = useQuery({
    queryKey: ["my-vehicles", status, page],
    queryFn: () => apiPaged<Vehicle[], { statusCounts: Record<string, number> }>(`/vehicles/mine?page=${page}&limit=20${status ? `&status=${status}` : ""}`),
  });
  const counts = q.data?.meta.statusCounts ?? {};

  async function act(v: Vehicle, action: "mark-sold" | "archive") {
    if (!confirm(action === "mark-sold" ? `Mark ${v.title} as sold?` : `${v.status === "DRAFT" ? "Delete" : "Archive"} ${v.title}?`)) return;
    try {
      if (action === "mark-sold") await api(`/vehicles/${v.id}/mark-sold`, { method: "POST", body: {} });
      else await api(`/vehicles/${v.id}`, { method: "DELETE" });
      toast.success(action === "mark-sold" ? "Marked as sold. Congratulations!" : "Done");
      qc.invalidateQueries({ queryKey: ["my-vehicles"] });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const ent = profile.data?.entitlements;
  return (
    <div>
      <PageHeader
        title="My vehicles"
        description={ent ? `${ent.activeListings} of ${ent.listingLimit} active listings used on ${ent.planName}` : undefined}
        actions={<Button asChild><Link href="/dashboard/vehicles/new"><PlusCircle /> Add vehicle</Link></Button>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {(["", ...VEHICLE_STATUSES.filter((s) => s !== "ARCHIVED")] as const).map((s) => (
          <button key={s || "all"} role="tab" aria-selected={status === s} onClick={() => (setStatus(s), setPage(1))} className={cn("rounded-full border px-3 py-1 text-sm", status === s ? "border-ink bg-ink text-white" : "border-border bg-white hover:bg-surface")}>
            {s ? LABELS.status[s] : "All"} {s && counts[s] ? <span className="opacity-70">({counts[s]})</span> : null}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <div className="grid gap-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data?.data.length ? (
        <EmptyState title="No vehicles here yet" description="Add your first car — it takes about three minutes." action={<Button asChild><Link href="/dashboard/vehicles/new">Add vehicle</Link></Button>} />
      ) : (
        <ul className="grid gap-2">
          {q.data.data.map((v) => (
            <li key={v.id} className="flex items-center gap-4 rounded-lg border border-border bg-white p-3 shadow-card">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-surface">
                {v.images[0] && <Image src={v.images[0].url} alt="" fill sizes="96px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dashboard/vehicles/${v.id}`} className="truncate font-semibold hover:underline">{v.title}</Link>
                  <Badge tone={TONE[v.status] ?? "neutral"}>{LABELS.status[v.status]}</Badge>
                  {v.isFeatured && <Badge tone="dark">Featured</Badge>}
                  {v.isBoosted && !v.isFeatured && <Badge tone="accent">Promoted</Badge>}
                </div>
                <p className="text-sm font-bold text-accent tabular">{v.price ? formatKes(v.price) : "No price yet"}</p>
                <p className="flex flex-wrap gap-3 text-xs text-ink-muted">
                  <span className="flex items-center gap-1"><Eye className="size-3.5" /> {v.stats?.views ?? 0}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="size-3.5" /> {v.stats?.whatsappClicks ?? 0} WhatsApp taps</span>
                  <span>{v.stats?.inquiries ?? 0} inquiries</span>
                  <span>Updated {relativeTime(v.updatedAt)}</span>
                </p>
                {v.status === "REJECTED" && v.rejectionReason && <p className="mt-1 text-xs text-warning">{v.rejectionReason}</p>}
              </div>
              <div className="flex items-center gap-1">
                {v.status === "ACTIVE" && (
                  <Button variant="whatsapp" size="sm" onClick={() => setSharing(v)} className="hidden sm:inline-flex"><Share2 /> Share</Button>
                )}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger className="rounded-md p-2 hover:bg-surface" aria-label={`Actions for ${v.title}`}><MoreHorizontal className="size-5" /></DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="end" className="z-50 min-w-44 rounded-lg border border-border bg-white p-1 shadow-raised">
                      {[
                        { label: "Edit", icon: Pencil, show: true, run: () => router.push(`/dashboard/vehicles/${v.id}`) },
                        { label: "Share", icon: Share2, show: v.status === "ACTIVE", run: () => setSharing(v) },
                        { label: "Mark as sold", icon: BadgeCheck, show: v.status === "ACTIVE", run: () => act(v, "mark-sold") },
                        { label: v.status === "DRAFT" ? "Delete draft" : "Archive", icon: Archive, show: v.status !== "SUSPENDED" && v.status !== "ARCHIVED", run: () => act(v, "archive") },
                      ]
                        .filter((a) => a.show)
                        .map(({ label, icon: Icon, run }) => (
                          <DropdownMenu.Item key={label} onSelect={run} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[highlighted]:bg-surface">
                            <Icon className="size-4 text-ink-muted" /> {label}
                          </DropdownMenu.Item>
                        ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.data && <Pagination page={page} totalPages={q.data.meta.totalPages} onPage={setPage} />}
      {sharing && <ShareDialog vehicle={sharing} sellerName={sellerName(profile.data, user?.name)} open={!!sharing} onOpenChange={(o) => !o && setSharing(null)} />}
    </div>
  );
}
