import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { PlanForm } from "./plan-form";
import { NewPriceForm, DeletePriceButton } from "./price-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlanEditPage({ params }: { params: Promise<{ planId: string }> }) {
  await requireRole(CONFIG_ROLES);
  const { planId } = await params;

  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { prices: true } });
  if (!plan) notFound();

  return (
    <div className="space-y-6">
      <Link href="/config/plans" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Plans
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          {plan.name} <span className="text-neutral-500">({plan.code})</span>
        </h1>
        <p className="text-sm text-neutral-500">
          {plan.subject} plan. Base price {plan.priceCents} cents (unedited here — see per-currency prices below).
        </p>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Draft/publish/version-history is not wired up for Plans/prices — this saves immediately (still
        audit-logged, CONFIG_ROLES-gated). Existing subscriptions with a locked price
        (<code>Subscription.lockedPriceCents</code>/<code>lockedCurrency</code>) are unaffected by a price change
        here. Money&rsquo;s MRR report still reads the live <code>Plan.priceCents</code>, not the locked price, for
        every subscription — a pre-existing limitation of that surface.
      </div>

      <Section title="Plan details">
        <PlanForm
          initial={{
            planId: plan.id,
            name: plan.name,
            features: plan.features,
            trialDays: plan.trialDays,
            maxGarages: plan.maxGarages,
            maxVehicles: plan.maxVehicles,
            maxSeats: plan.maxSeats,
            maxJobsPerMonth: plan.maxJobsPerMonth,
            maxStaff: plan.maxStaff,
          }}
        />
      </Section>

      <Section title="Per-currency prices">
        <DataTable
          rows={plan.prices}
          emptyLabel="No per-currency prices yet — the base price above applies everywhere."
          columns={[
            { header: "Currency", cell: (p) => p.currency },
            { header: "Price (cents)", cell: (p) => p.priceCents },
            { header: "Updated", cell: (p) => formatDateTime(p.updatedAt) },
            { header: "", cell: (p) => <DeletePriceButton priceId={p.id} /> },
          ]}
        />
        <NewPriceForm planId={plan.id} />
      </Section>
    </div>
  );
}
