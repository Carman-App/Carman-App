import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { ConfigTabs } from "../config-tabs";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireRole(CONFIG_ROLES);

  const plans = await prisma.plan.findMany({
    include: { prices: true, _count: { select: { subscriptions: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configuration</h1>
        <p className="text-sm text-neutral-500">
          CFG-02 Plans & prices — direct-edit only, not staged through the CFG-06/07 draft/publish mechanism (see
          note below). Every edit is still audit-logged.
        </p>
      </div>

      <ConfigTabs active="plans" />

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Draft/publish/version-history is not wired up for Plans/prices — edits here go live immediately (audit-logged,
        CONFIG_ROLES-gated). <strong>Grandfathering:</strong> existing subscriptions with{" "}
        <code>Subscription.lockedPriceCents</code>/<code>lockedCurrency</code> set keep the price agreed at signup or
        last migration — editing a price here never silently changes what an existing locked subscriber is billed.{" "}
        <strong>MRR limitation:</strong> Money&rsquo;s MRR report (<code>src/lib/money/mrr.ts</code>) currently reads
        the live <code>Plan.priceCents</code> for every subscription and does not yet consult{" "}
        <code>lockedPriceCents</code> — a pre-existing limitation of that surface, not something changed here.
      </div>

      <Section title="Plans">
        <DataTable
          rows={plans}
          emptyLabel="No plans seeded yet."
          href={(p) => `/config/plans/${p.id}`}
          columns={[
            { header: "Code", cell: (p) => p.code },
            { header: "Subject", cell: (p) => p.subject },
            { header: "Name", cell: (p) => p.name },
            { header: "Base price (cents)", cell: (p) => p.priceCents },
            { header: "Per-currency prices", cell: (p) => p.prices.length },
            { header: "Trial days", cell: (p) => p.trialDays ?? "—" },
            { header: "Subscribers", cell: (p) => p._count.subscriptions },
          ]}
        />
      </Section>
    </div>
  );
}
