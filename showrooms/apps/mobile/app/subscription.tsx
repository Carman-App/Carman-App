import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { formatKes, type Entitlements, type Payment, type Plan } from "@showrooms/shared";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, Card, Loading, ProgressBar } from "@/components/ui/misc";
import { api, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";

const idempotencyKey = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Polls the server for the payment outcome; nothing unlocks on the phone itself. */
function usePayment(id: string | null, onDone: (p: Payment) => void) {
  const [payment, setPayment] = useState<Payment | null>(null);
  useEffect(() => {
    if (!id) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      const p = await api<Payment>(`/payments/${id}`).catch(() => null);
      if (p) setPayment(p);
      if (p && p.status !== "PENDING" && p.status !== "INITIATED") return onDone(p);
      if (Date.now() - started < 180_000) setTimeout(tick, 3000);
    };
    tick();
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return payment;
}

export default function Subscription() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["subscription"], queryFn: () => api<{ entitlements: Entitlements; canManageBilling: boolean }>("/subscriptions/me") });
  const plans = useQuery({ queryKey: ["plans", user?.role], queryFn: () => api<Plan[]>(`/subscriptions/plans?audience=${user?.role === "DEALER" ? "DEALER" : "BROKER"}`) });
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const payment = usePayment(paymentId, (p) => {
    qc.invalidateQueries({ queryKey: ["subscription"] });
    qc.invalidateQueries({ queryKey: ["seller-profile"] });
    Alert.alert(p.status === "SUCCESS" ? "Payment received" : "Payment not completed", p.status === "SUCCESS" ? "Your plan is active." : (p.failureReason ?? "Please try again."));
    setPaymentId(null);
  });

  async function buy(plan: Plan) {
    setBusy(plan.code);
    try {
      const res = await api<{ payment: Payment | null }>("/subscriptions", { method: "POST", body: { planCode: plan.code, phone: phone || undefined }, headers: { "Idempotency-Key": idempotencyKey() } });
      if (!res.payment) qc.invalidateQueries({ queryKey: ["subscription"] });
      else if (res.payment.status === "FAILED") Alert.alert("Payment not started", res.payment.failureReason ?? "Try again.");
      else setPaymentId(res.payment.id);
    } catch (err) {
      Alert.alert("Couldn't start payment", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const ent = mine.data?.entitlements;
  if (!ent) return <Loading />;
  return (
    <Screen edges={["bottom"]} className="gap-4 pt-4">
      <Card className="gap-2">
        <Text className="font-semibold">Current plan: {ent.planName}</Text>
        <Text className="text-sm text-ink-muted">{ent.activeListings} of {ent.listingLimit} active listings</Text>
        <ProgressBar value={(ent.activeListings / Math.max(1, ent.listingLimit)) * 100} />
      </Card>
      {paymentId ? (
        <Card className="gap-2 border-accent bg-accent-soft">
          <Text className="font-semibold">Check your phone</Text>
          <Text className="text-sm text-ink">Enter your M-Pesa PIN on the prompt sent to {phone}. Status: {payment?.status.toLowerCase() ?? "pending"}.</Text>
        </Card>
      ) : null}
      {mine.data?.canManageBilling ? <Input label="M-Pesa number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712 345 678" /> : <Text className="text-sm text-ink-muted">Only the dealership owner can change the plan.</Text>}
      {plans.data?.map((p) => (
        <Card key={p.id} className={`gap-2 ${p.code === ent.planCode ? "border-success" : ""}`}>
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold">{p.name}</Text>
            {p.code === ent.planCode ? <Badge label="Current" tone="success" /> : null}
          </View>
          <Text className="text-2xl font-extrabold text-ink">{p.priceKes ? formatKes(p.priceKes) : "Free"}<Text className="text-sm font-normal text-ink-muted">{p.priceKes ? ` / ${p.periodDays} days` : ""}</Text></Text>
          {p.highlights.map((h) => <Text key={h} className="text-sm text-ink-muted">✓ {h}</Text>)}
          {p.priceKes > 0 && mine.data?.canManageBilling ? <Button title={p.code === ent.planCode ? "Renew with M-Pesa" : `Pay ${formatKes(p.priceKes)} with M-Pesa`} loading={busy === p.code} disabled={!!paymentId || !phone} onPress={() => buy(p)} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
