import Link from "next/link";
import { Section } from "@/components/detail-view";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { findAccountsLinkedByPaymentMethod } from "@/lib/trust/linked-accounts";

export const dynamic = "force-dynamic";

export default async function LinkedAccountsPage() {
  await requireRole(TRUST_ROLES);
  const groups = await findAccountsLinkedByPaymentMethod();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/trust" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Reports & disputes
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Linked accounts</h1>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">These are possible links, never a verdict.</p>
        <p className="mt-1">
          No device or phone-number tracking exists yet in this product, so this can only ever group
          by shared payment method once a payment processor is connected — see the Money surface.
          Subscription.paymentMethodBrand/paymentMethodLast4 stay null until then, so the grouping
          below is real logic that will start surfacing matches the moment those fields are
          populated, not a fabricated result.
        </p>
      </div>

      <Section title="Grouped by shared payment method">
        {groups.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No groups to show — either no subscriptions have a payment method on file yet, or none
            of them are shared across more than one account.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.key} className="rounded border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-800">{g.label}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {g.accounts.map((a) => (
                    <li key={a.accountId}>
                      <Link href={`/accounts/${a.accountId}`} className="hover:underline">
                        {a.name} ({a.email})
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
