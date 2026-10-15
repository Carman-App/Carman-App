"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatKes, type Entitlements, type Payment, type Plan, type Subscription } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/features/auth/auth-provider";
import { newIdempotencyKey, usePaymentStatus } from "@/features/billing/use-payment";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { cn, formatDate } from "@/lib/utils";

interface Mine { entitlements: Entitlements; active: Subscription | null; canManageBilling: boolean }

function Checkout({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payment = usePaymentStatus(paymentId, (p) => {
    if (p.status === "SUCCESS") {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    }
  });
  async function pay() {
    setBusy(true);
    try {
      const res = await api<{ payment: Payment | null }>("/subscriptions", { method: "POST", body: { planCode: plan.code, phone }, headers: { "Idempotency-Key": newIdempotencyKey() } });
      if (!res.payment) {
        toast.success(`Switched to ${plan.name}`);
        qc.invalidateQueries({ queryKey: ["subscription"] });
        onClose();
      } else if (res.payment.status === "FAILED") toast.error(res.payment.failureReason ?? "Payment could not be started");
      else setPaymentId(res.payment.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const done = payment && payment.status !== "PENDING" && payment.status !== "INITIATED";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Upgrade to ${plan.name}`} description={`${formatKes(plan.priceKes)} for ${plan.periodDays} days, paid with M-Pesa.`}>
        {paymentId ? (
          <div className="space-y-3 text-center" role="status" aria-live="polite">
            {payment?.status === "SUCCESS" ? (
              <><CheckCircle2 className="mx-auto size-10 text-success" /><p className="font-semibold">You&apos;re on {plan.name}!</p><Button onClick={onClose}>Done</Button></>
            ) : done ? (
              <><XCircle className="mx-auto size-10 text-danger" /><p className="font-semibold">{payment?.failureReason ?? "Payment not completed"}</p><Button onClick={() => setPaymentId(null)}>Try again</Button></>
            ) : (
              <><div className="mx-auto size-10 animate-spin rounded-full border-4 border-border border-t-accent" /><p className="font-semibold">Check your phone</p><p className="text-sm text-ink-muted">Approve the M-Pesa prompt sent to {phone}.</p></>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <Field label="M-Pesa phone number" htmlFor="sub-phone"><Input id="sub-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /></Field>
            <Button onClick={pay} loading={busy} disabled={!phone}>Pay {formatKes(plan.priceKes)}</Button>
            <p className="text-xs text-ink-muted">Your plan activates only after Safaricom confirms the payment to us.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionInner() {
  const { user } = useAuth();
  const params = useSearchParams();
  const mine = useQuery({ queryKey: ["subscription"], queryFn: () => api<Mine>("/subscriptions/me") });
  const plans = useQuery({ queryKey: ["plans", user?.role], queryFn: () => api<Plan[]>(`/subscriptions/plans?audience=${user?.role === "DEALER" ? "DEALER" : "BROKER"}`) });
  const [selected, setSelected] = useState<Plan | null>(null);
  const preselect = params.get("plan");
  const ent = mine.data?.entitlements;

  if (!ent) return <Skeleton className="h-96" />;
  const pct = Math.min(100, Math.round((ent.activeListings / Math.max(1, ent.listingLimit)) * 100));
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Subscription" description="Plans renew manually; you'll get a reminder before yours ends." />
      <div className="rounded-lg border border-border bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Current plan: {ent.planName} <Badge tone="accent">{ent.planCode}</Badge></p>
          {ent.subscriptionEndsAt && <p className="text-sm text-ink-muted">Renews by {formatDate(ent.subscriptionEndsAt)}</p>}
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm"><span>Active listings</span><span className="tabular">{ent.activeListings} / {ent.listingLimit}</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className={cn("h-full", pct > 90 ? "bg-danger" : "bg-accent")} style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
      {!mine.data?.canManageBilling && <p className="text-sm text-ink-muted">Only the dealership owner can change the plan.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.data?.map((p) => {
          const current = p.code === ent.planCode;
          return (
            <div key={p.id} className={cn("flex flex-col rounded-xl border bg-white p-5 shadow-card", current ? "border-success" : preselect === p.code ? "border-accent ring-1 ring-accent" : "border-border")}>
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-2xl font-extrabold tabular">{p.priceKes ? formatKes(p.priceKes) : "Free"}</p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.highlights.map((h) => <li key={h} className="flex gap-2"><Check className="size-4 shrink-0 text-success" /> {h}</li>)}</ul>
              <Button className="mt-5" variant={current ? "outline" : "primary"} disabled={(current && p.priceKes === 0) || !mine.data?.canManageBilling} onClick={() => setSelected(p)}>
                {current ? (p.priceKes ? "Renew" : "Current plan") : p.priceKes ? `Get ${p.name}` : "Switch to Free"}
              </Button>
            </div>
          );
        })}
      </div>
      {selected && <Checkout plan={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default function SubscriptionPage() {
  return <Suspense><SubscriptionInner /></Suspense>;
}
