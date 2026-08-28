import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate } from "@/lib/format";
import { Section } from "@/components/detail-view";
import { requireRole, BILLING_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

async function getBillingData() {
  const [plans, subscriptions] = await Promise.all([
    prisma.plan.findMany({ orderBy: { priceCents: "asc" } }),
    prisma.subscription.findMany({
      include: { plan: true, account: { include: { user: true } }, workshop: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  return { plans, subscriptions };
}

export default async function BillingPage() {
  await requireRole(BILLING_ROLES);
  const { plans, subscriptions } = await getBillingData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Billing & Plans</h1>
        <p className="text-sm text-neutral-500">
          Plan catalog and every subscription. Usage against a plan&rsquo;s limits is computed live
          from real rows (see src/lib/limits.ts), not stored separately.
        </p>
      </div>

      <Section title="Plan catalog">
        <DataTable
          rows={plans}
          emptyLabel="No plans seeded yet."
          columns={[
            { header: "Code", cell: (r) => r.code },
            { header: "Name", cell: (r) => r.name },
            { header: "Subject", cell: (r) => <Badge value={r.subject} /> },
            { header: "Garages", cell: (r) => r.maxGarages ?? "Unlimited" },
            { header: "Vehicles", cell: (r) => r.maxVehicles ?? "Unlimited" },
            { header: "Jobs/mo", cell: (r) => r.maxJobsPerMonth ?? "Unlimited" },
            { header: "Staff", cell: (r) => r.maxStaff ?? "Unlimited" },
            { header: "Price", cell: (r) => (r.priceCents === 0 ? "Free" : `${(r.priceCents / 100).toFixed(2)}`) },
          ]}
        />
      </Section>

      <Section title="Subscriptions">
        <DataTable
          rows={subscriptions}
          emptyLabel="No subscriptions yet."
          columns={[
            {
              header: "Subject",
              cell: (r) => r.account?.user.name ?? r.workshop?.name ?? "—",
            },
            { header: "Plan", cell: (r) => r.plan.name },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            { header: "Trial ends", cell: (r) => formatDate(r.trialEndsAt) },
            { header: "Period ends", cell: (r) => formatDate(r.currentPeriodEnd) },
          ]}
        />
      </Section>
    </div>
  );
}
