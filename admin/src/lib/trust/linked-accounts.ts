import "server-only";
import { prisma } from "@/lib/prisma";

// TRUST-04 "accounts sharing a device/number/payment-method grouped as a
// possible link" — this is a possible-link signal, never a verdict.
//
// No device-fingerprint or phone-number tracking exists anywhere in this
// codebase (the mobile app registers neither), so those two signals are
// honest placeholders below. The only real signal available today is
// Subscription.paymentMethodBrand/paymentMethodLast4 — both stay null until
// a payment processor is connected (see .env.example STRIPE_* vars and the
// Money surface), so in practice this will show no groups until then. The
// grouping logic itself is real and will start surfacing matches the
// moment those fields get populated.

export type LinkedAccountGroup = {
  key: string;
  signal: "payment_method";
  label: string; // e.g. "Visa •••• 4242"
  accounts: { accountId: string; name: string; email: string }[];
};

export async function findAccountsLinkedByPaymentMethod(): Promise<LinkedAccountGroup[]> {
  const subs = await prisma.subscription.findMany({
    where: {
      accountId: { not: null },
      paymentMethodBrand: { not: null },
      paymentMethodLast4: { not: null },
    },
    select: {
      accountId: true,
      paymentMethodBrand: true,
      paymentMethodLast4: true,
      account: { select: { id: true, user: { select: { name: true, email: true } } } },
    },
  });

  const groups = new Map<
    string,
    { brand: string; last4: string; accounts: Map<string, { accountId: string; name: string; email: string }> }
  >();

  for (const sub of subs) {
    if (!sub.accountId || !sub.account || !sub.paymentMethodBrand || !sub.paymentMethodLast4) continue;
    const key = `${sub.paymentMethodBrand}:${sub.paymentMethodLast4}`;
    if (!groups.has(key)) {
      groups.set(key, { brand: sub.paymentMethodBrand, last4: sub.paymentMethodLast4, accounts: new Map() });
    }
    const group = groups.get(key)!;
    group.accounts.set(sub.accountId, {
      accountId: sub.accountId,
      name: sub.account.user.name,
      email: sub.account.user.email,
    });
  }

  const result: LinkedAccountGroup[] = [];
  for (const [key, group] of groups) {
    if (group.accounts.size < 2) continue; // only a "link" if more than one account shares it
    result.push({
      key,
      signal: "payment_method",
      label: `${group.brand} •••• ${group.last4}`,
      accounts: [...group.accounts.values()],
    });
  }
  return result;
}
