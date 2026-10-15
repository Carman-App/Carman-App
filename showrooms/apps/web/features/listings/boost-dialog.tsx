"use client";

import { CheckCircle2, Rocket, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatKes, type Boost, type BoostPackage, type Payment, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { newIdempotencyKey, usePaymentStatus } from "@/features/billing/use-payment";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

export function BoostDialog({ vehicle }: { vehicle: Vehicle }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const packages = useQuery({ queryKey: ["boost-packages"], queryFn: () => api<BoostPackage[]>("/boosts/packages"), enabled: open });
  const payment = usePaymentStatus(paymentId, (p) => p.status === "SUCCESS" && qc.invalidateQueries({ queryKey: ["vehicle", vehicle.id] }));

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ boost: Boost; payment: Payment }>(`/vehicles/${vehicle.id}/boost`, { method: "POST", body: { packageCode: code, phone }, headers: { "Idempotency-Key": newIdempotencyKey() } });
      if (res.payment.status === "FAILED") setError(res.payment.failureReason ?? "Payment could not be started");
      else setPaymentId(res.payment.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const reset = () => {
    setPaymentId(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || reset())}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={vehicle.status !== "ACTIVE"}>
          <Rocket /> Promote
        </Button>
      </DialogTrigger>
      <DialogContent title="Promote this listing" description="Pay with M-Pesa. The promotion starts as soon as Safaricom confirms payment.">
        {paymentId ? (
          <div className="space-y-4 text-center" role="status" aria-live="polite">
            {payment?.status === "SUCCESS" ? (
              <>
                <CheckCircle2 className="mx-auto size-10 text-success" />
                <p className="font-semibold">Payment received{payment.mpesaReceiptNumber ? ` (${payment.mpesaReceiptNumber})` : ""}. Your listing is promoted.</p>
              </>
            ) : payment && payment.status !== "PENDING" && payment.status !== "INITIATED" ? (
              <>
                <XCircle className="mx-auto size-10 text-danger" />
                <p className="font-semibold">{payment.status === "CANCELLED" ? "Payment cancelled" : "Payment failed"}</p>
                <p className="text-sm text-ink-muted">{payment.failureReason}</p>
                <Button onClick={reset}>Try again</Button>
              </>
            ) : (
              <>
                <div className="mx-auto size-10 animate-spin rounded-full border-4 border-border border-t-accent" />
                <p className="font-semibold">Check your phone</p>
                <p className="text-sm text-ink-muted">Enter your M-Pesa PIN on the prompt sent to {phone}. This page updates automatically.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2" role="radiogroup" aria-label="Promotion">
              {(packages.data ?? []).map((p) => (
                <button key={p.code} type="button" role="radio" aria-checked={code === p.code} onClick={() => setCode(p.code)} className={cn("flex items-center justify-between rounded-lg border p-3 text-left", code === p.code ? "border-accent bg-accent-soft" : "border-border hover:bg-surface")}>
                  <span>
                    <span className="block text-sm font-semibold">{p.name}</span>
                    <span className="block text-xs text-ink-muted">{p.type === "FEATURED" ? "Top of search and the homepage" : "Shown higher in search"}</span>
                  </span>
                  <span className="font-bold tabular">{formatKes(p.priceKes)}</span>
                </button>
              ))}
            </div>
            <Field label="M-Pesa number" htmlFor="b-phone">
              <Input id="b-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
            </Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button className="w-full" onClick={pay} disabled={!code || !phone} loading={busy}>Pay with M-Pesa</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
