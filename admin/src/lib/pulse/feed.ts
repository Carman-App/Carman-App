import { prismaRead as prisma } from "@/lib/prisma";

/**
 * PULSE-03's live feed. Deliberately carries only a type + the account it
 * belongs to — "explicitly NO amounts, NO photos in this feed (it reads as
 * semi-public within the console)." Never add a money or file field here.
 */
export type FeedEventType =
  | "account_created"
  | "garage_created"
  | "vehicle_added"
  | "record_logged"
  | "job_opened"
  | "invoice_paid";

export type FeedItem = {
  id: string;
  type: FeedEventType;
  at: Date;
  accountId: string;
  accountName: string;
  detail: string; // short, non-financial description, e.g. "Ngong Road Garage" or "Service record"
};

const FEED_LABELS: Record<FeedEventType, string> = {
  account_created: "New account",
  garage_created: "Garage created",
  vehicle_added: "Vehicle added",
  record_logged: "Record logged",
  job_opened: "Job opened",
  invoice_paid: "Invoice payment",
};

export function feedEventLabel(type: FeedEventType): string {
  return FEED_LABELS[type];
}

const PER_SOURCE_LIMIT = 20;

export async function getLiveFeed(limit = 30): Promise<FeedItem[]> {
  const [accounts, garages, vehicles, fuel, service, repair, expense, odometer, jobs, payments] =
    await Promise.all([
      prisma.account.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { user: true },
      }),
      prisma.garage.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { owner: { include: { user: true } } },
      }),
      prisma.vehicle.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { garage: { include: { owner: { include: { user: true } } } } },
      }),
      prisma.fuelRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { vehicle: { include: { garage: { include: { owner: { include: { user: true } } } } } } },
      }),
      prisma.serviceRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { vehicle: { include: { garage: { include: { owner: { include: { user: true } } } } } } },
      }),
      prisma.repairRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { vehicle: { include: { garage: { include: { owner: { include: { user: true } } } } } } },
      }),
      prisma.expenseRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { vehicle: { include: { garage: { include: { owner: { include: { user: true } } } } } } },
      }),
      prisma.odometerReading.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { vehicle: { include: { garage: { include: { owner: { include: { user: true } } } } } } },
      }),
      prisma.job.findMany({
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: { workshop: { include: { owner: { include: { user: true } } } } },
      }),
      prisma.payment.findMany({
        where: { deletedAt: null },
        orderBy: { paidAt: "desc" },
        take: PER_SOURCE_LIMIT,
        include: {
          invoice: {
            include: { vehicle: { include: { garage: { include: { owner: { include: { user: true } } } } } } },
          },
        },
      }),
    ]);

  const items: FeedItem[] = [
    ...accounts.map((a) => ({
      id: `account_created:${a.id}`,
      type: "account_created" as const,
      at: a.createdAt,
      accountId: a.id,
      accountName: a.user.name,
      detail: a.region,
    })),
    ...garages.map((g) => ({
      id: `garage_created:${g.id}`,
      type: "garage_created" as const,
      at: g.createdAt,
      accountId: g.ownerId,
      accountName: g.owner.user.name,
      detail: g.name,
    })),
    ...vehicles.map((v) => ({
      id: `vehicle_added:${v.id}`,
      type: "vehicle_added" as const,
      at: v.createdAt,
      accountId: v.garage.ownerId,
      accountName: v.garage.owner.user.name,
      detail: `${v.year} ${v.make} ${v.model}`,
    })),
    ...fuel.map((r) => ({
      id: `record_logged:fuel:${r.id}`,
      type: "record_logged" as const,
      at: r.createdAt,
      accountId: r.vehicle.garage.ownerId,
      accountName: r.vehicle.garage.owner.user.name,
      detail: "Fuel record",
    })),
    ...service.map((r) => ({
      id: `record_logged:service:${r.id}`,
      type: "record_logged" as const,
      at: r.createdAt,
      accountId: r.vehicle.garage.ownerId,
      accountName: r.vehicle.garage.owner.user.name,
      detail: "Service record",
    })),
    ...repair.map((r) => ({
      id: `record_logged:repair:${r.id}`,
      type: "record_logged" as const,
      at: r.createdAt,
      accountId: r.vehicle.garage.ownerId,
      accountName: r.vehicle.garage.owner.user.name,
      detail: "Repair record",
    })),
    ...expense.map((r) => ({
      id: `record_logged:expense:${r.id}`,
      type: "record_logged" as const,
      at: r.createdAt,
      accountId: r.vehicle.garage.ownerId,
      accountName: r.vehicle.garage.owner.user.name,
      detail: "Expense record",
    })),
    ...odometer.map((r) => ({
      id: `record_logged:odometer:${r.id}`,
      type: "record_logged" as const,
      at: r.createdAt,
      accountId: r.vehicle.garage.ownerId,
      accountName: r.vehicle.garage.owner.user.name,
      detail: "Odometer reading",
    })),
    ...jobs.map((j) => ({
      id: `job_opened:${j.id}`,
      type: "job_opened" as const,
      at: j.createdAt,
      accountId: j.workshop.ownerId,
      accountName: j.workshop.owner.user.name,
      detail: j.workshop.name,
    })),
    ...payments.map((p) => ({
      id: `invoice_paid:${p.id}`,
      type: "invoice_paid" as const,
      at: p.paidAt,
      accountId: p.invoice.vehicle.garage.ownerId,
      accountName: p.invoice.vehicle.garage.owner.user.name,
      detail: p.invoice.status === "PAID" ? "Invoice paid in full" : "Payment recorded",
    })),
  ];

  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  return items.slice(0, limit);
}
