"use client";

import { useEffect, useState } from "react";
import type { Payment } from "@showrooms/shared";
import { api } from "@/lib/api-client";

/**
 * Polls a payment after an STK push. The UI only reflects what the server
 * says; nothing is unlocked on the client.
 */
export function usePaymentStatus(paymentId: string | null, onDone?: (p: Payment) => void) {
  const [payment, setPayment] = useState<Payment | null>(null);
  useEffect(() => {
    if (!paymentId) return;
    let stopped = false;
    const started = Date.now();
    async function tick() {
      if (stopped) return;
      try {
        const p = await api<Payment>(`/payments/${paymentId}`);
        setPayment(p);
        if (p.status !== "PENDING" && p.status !== "INITIATED") {
          onDone?.(p);
          return;
        }
      } catch {
        /* keep polling through blips */
      }
      if (Date.now() - started < 3 * 60_000) setTimeout(tick, 3000);
    }
    tick();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);
  return payment;
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}
