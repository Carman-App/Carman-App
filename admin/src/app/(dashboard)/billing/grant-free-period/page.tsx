import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";
import { BillingNav } from "../billing-nav";
import { SubscriptionStatus } from "@/generated/prisma/enums";
import { GrantPanel, type GrantableSubscription } from "./grant-panel";

export const dynamic = "force-dynamic";

// MON-08 — extend a trial or grant a free period.

export default async function GrantFreePeriodPage() {
  await requireRole(BILLING_ROLES);

  const subscriptions = await prisma.subscription.findMany({
    where: { status: { not: SubscriptionStatus.CANCELED } },
    include: { plan: true, account: { include: { user: true } }, workshop: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const options: GrantableSubscription[] = subscriptions.map((s) => ({
    id: s.id,
    label: `${s.account?.user.name ?? s.workshop?.name ?? s.id} — ${s.plan.name} (${s.status})`,
    status: s.status,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Extend trial / grant free period</h1>
        <p className="text-sm text-neutral-500">
          Writes a real, time-boxed end date onto the subscription (<code>trialEndsAt</code> for a
          trial extension, <code>currentPeriodEnd</code> for a free period) and a real{" "}
          <code>SubscriptionEvent</code> row. Visible on the account&rsquo;s billing history section.
        </p>
      </div>

      <BillingNav active="/billing/grant-free-period" />

      <Section title="Grant">
        <GrantPanel options={options} />
      </Section>
    </div>
  );
}
