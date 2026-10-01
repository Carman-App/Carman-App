import "server-only";
import { prisma } from "@/lib/prisma";
import { currencyForRegion } from "@/lib/region";
import type { Prisma } from "@/generated/prisma/client";
import type { Region } from "@/generated/prisma/enums";

/**
 * Read models behind the web report (web/): one consistent snapshot per
 * garage (expense report) or workshop (work report), so a report is built
 * from a single point in time rather than stitched together from dozens of
 * paginated list calls — the per-resource list endpoints cap pageSize at 100
 * (src/lib/api/pagination.ts), and a report that silently drops rows past
 * that cap would break the brief's "summaries reconcile exactly to the line
 * items" rule.
 *
 * Everything is computed client-side from these payloads (the report is
 * generated on the device, per the brief), so these functions only select
 * and shape rows; they never aggregate. Money is serialized as fixed
 * two-decimal strings (Decimal(12,2) columns) so the client can convert to
 * integer minor units without floating-point drift.
 */

type Decimalish = Prisma.Decimal | null | undefined;

function money(value: Decimalish): string | null {
  return value == null ? null : value.toFixed(2);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

// ---------------------------------------------------------------------------
// Conventions — currency, units and date format for the calling account.
// ---------------------------------------------------------------------------

export type ReportConventions = {
  region: Region;
  countryName: string | null;
  currencyCode: string;
  currencySymbol: string | null;
  currencySymbolPlacement: "BEFORE" | "AFTER";
  distanceUnit: "KM" | "MI";
  volumeUnit: "LITRE" | "GALLON";
  dateFormat: string;
  /** Where these came from: the admin-editable Country config row, or the built-in per-region defaults when no row exists. */
  source: "country_config" | "region_default";
};

// Fallbacks for when no Country config row exists for the region yet —
// the same assumptions the mobile app's REGION_UNITS table makes.
const REGION_DEFAULT_UNITS: Partial<Record<Region, Pick<ReportConventions, "distanceUnit" | "volumeUnit" | "dateFormat">>> = {
  US: { distanceUnit: "MI", volumeUnit: "GALLON", dateFormat: "MM/DD/YYYY" },
  GB: { distanceUnit: "MI", volumeUnit: "LITRE", dateFormat: "DD/MM/YYYY" },
};

export async function getReportConventions(region: Region): Promise<ReportConventions> {
  const country = await prisma.country.findUnique({ where: { code: region } });
  if (country) {
    return {
      region,
      countryName: country.name,
      currencyCode: country.currencyCode,
      currencySymbol: country.currencySymbol,
      currencySymbolPlacement: country.currencySymbolPlacement,
      distanceUnit: country.distanceUnit,
      volumeUnit: country.volumeUnit,
      dateFormat: country.dateFormat,
      source: "country_config",
    };
  }
  const units = REGION_DEFAULT_UNITS[region] ?? { distanceUnit: "KM", volumeUnit: "LITRE", dateFormat: "DD/MM/YYYY" };
  return {
    region,
    countryName: null,
    currencyCode: currencyForRegion(region),
    currencySymbol: null,
    currencySymbolPlacement: "BEFORE",
    ...units,
    source: "region_default",
  };
}

type ReportAccount = { id: string; region: Region; user: { name: string } };

function accountSummary(account: ReportAccount) {
  return { id: account.id, name: account.user.name, region: account.region };
}

// ---------------------------------------------------------------------------
// Service intervals (CFG-03 "service_intervals" config list).
// ---------------------------------------------------------------------------

export type ServiceIntervalRow = {
  code: string;
  label: string;
  vehicleClass: string | null;
  intervalKm: number | null;
  intervalMonths: number | null;
};

async function getServiceIntervals(): Promise<ServiceIntervalRow[]> {
  const list = await prisma.configList.findUnique({
    where: { key: "service_intervals" },
    include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!list) return [];
  return list.items.map((item) => {
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
    return {
      code: item.code,
      label: item.label,
      vehicleClass: typeof meta.vehicleClass === "string" ? meta.vehicleClass : null,
      intervalKm: num(meta.intervalKm),
      intervalMonths: num(meta.intervalMonths),
    };
  });
}

// ---------------------------------------------------------------------------
// Garage snapshot — the expense report's input.
// ---------------------------------------------------------------------------

export async function getGarageReportData(garageId: string, account: ReportAccount) {
  const [garage, conventions, serviceIntervals] = await Promise.all([
    prisma.garage.findUniqueOrThrow({
      where: { id: garageId },
      include: {
        members: { orderBy: { joinedAt: "asc" } },
        vehicles: { orderBy: { createdAt: "asc" } },
      },
    }),
    getReportConventions(account.region),
    getServiceIntervals(),
  ]);

  const vehicleIds = garage.vehicles.map((v) => v.id);
  const inGarage = { vehicleId: { in: vehicleIds } };

  const [fuel, service, repair, expense, odometer, reminders, documents, projects] = await Promise.all([
    prisma.fuelRecord.findMany({ where: inGarage, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.serviceRecord.findMany({ where: inGarage, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.repairRecord.findMany({ where: inGarage, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.expenseRecord.findMany({ where: inGarage, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    // OdometerReading has no deletedAt — a deleted reading is hard-deleted (see records/[id]/route.ts).
    prisma.odometerReading.findMany({ where: inGarage, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.reminder.findMany({ where: { ...inGarage, resolved: false }, orderBy: { createdAt: "asc" } }),
    prisma.document.findMany({
      where: { ...inGarage, deletedAt: null },
      include: { documentType: true },
      orderBy: { addedAt: "asc" },
    }),
    prisma.project.findMany({
      where: inGarage,
      orderBy: { createdAt: "asc" },
      include: {
        stages: {
          orderBy: { createdAt: "asc" },
          include: { modifications: true, parts: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] } },
        },
      },
    }),
  ]);

  type Row = {
    id: string;
    vehicleId: string;
    date: Date;
    enteredByAccountId: string | null;
    enteredByName: string;
    notes: string | null;
    createdAt: Date;
    editedAt: Date | null;
  };
  const base = (r: Row) => ({
    id: r.id,
    vehicleId: r.vehicleId,
    date: iso(r.date),
    enteredByAccountId: r.enteredByAccountId,
    enteredByName: r.enteredByName,
    notes: r.notes,
    createdAt: iso(r.createdAt),
    editedAt: iso(r.editedAt),
  });

  const live = <T extends { deletedAt: Date | null }>(rows: T[]) => rows.filter((r) => r.deletedAt == null);
  const gone = <T extends { deletedAt: Date | null }>(rows: T[]) => rows.filter((r) => r.deletedAt != null);

  const records = [
    ...live(fuel).map((r) => ({
      ...base(r),
      type: "fuel" as const,
      amount: money(r.amount),
      litres: r.litres == null ? null : r.litres.toFixed(3),
      odometerKm: r.odometerAtEntry,
      category: "FUEL",
      description: null,
      place: r.place,
    })),
    ...live(service).map((r) => ({
      ...base(r),
      type: "service" as const,
      amount: money(r.amount),
      litres: null,
      odometerKm: r.odometerAtEntry,
      category: "SERVICE",
      description: r.description,
      place: r.place,
    })),
    ...live(repair).map((r) => ({
      ...base(r),
      type: "repair" as const,
      amount: money(r.amount),
      litres: null,
      odometerKm: r.odometerAtEntry,
      category: "REPAIR",
      description: r.description,
      place: r.place,
    })),
    ...live(expense).map((r) => ({
      ...base(r),
      type: "expense" as const,
      amount: money(r.amount),
      litres: null,
      odometerKm: r.odometerAtEntry,
      category: r.category as string,
      description: null,
      place: r.place,
    })),
    ...odometer.map((r) => ({
      ...base(r),
      type: "odometer" as const,
      amount: null,
      litres: null,
      odometerKm: r.odometerKm,
      category: null,
      description: null,
      place: null,
    })),
  ];

  // Soft-deleted rows are never part of a total — they're returned only so
  // the report can state "N records deleted after entry are excluded" and
  // reconcile, per the brief (SHARE-05 / TAX-03). Minimal fields only.
  const deletedRecords = [
    ...gone(fuel).map((r) => ({ id: r.id, vehicleId: r.vehicleId, type: "fuel" as const, date: iso(r.date), amount: money(r.amount), deletedAt: iso(r.deletedAt) })),
    ...gone(service).map((r) => ({ id: r.id, vehicleId: r.vehicleId, type: "service" as const, date: iso(r.date), amount: money(r.amount), deletedAt: iso(r.deletedAt) })),
    ...gone(repair).map((r) => ({ id: r.id, vehicleId: r.vehicleId, type: "repair" as const, date: iso(r.date), amount: money(r.amount), deletedAt: iso(r.deletedAt) })),
    ...gone(expense).map((r) => ({ id: r.id, vehicleId: r.vehicleId, type: "expense" as const, date: iso(r.date), amount: money(r.amount), deletedAt: iso(r.deletedAt) })),
  ];

  return {
    generatedAt: new Date().toISOString(),
    account: accountSummary(account),
    conventions,
    garage: {
      id: garage.id,
      name: garage.name,
      location: garage.location,
      ownerId: garage.ownerId,
      createdAt: iso(garage.createdAt),
    },
    members: garage.members.map((m) => ({
      id: m.id,
      accountId: m.accountId,
      displayName: m.displayName,
      role: m.role,
      joinedAt: iso(m.joinedAt),
      removedAt: iso(m.removedAt),
    })),
    vehicles: garage.vehicles.map((v) => ({
      id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      type: v.type,
      usage: v.usage,
      plate: v.plate,
      odometerKm: v.odometerKm,
      powertrain: v.powertrain,
      nextServiceDueKm: v.nextServiceDueKm,
      createdAt: iso(v.createdAt),
    })),
    records,
    deletedRecords,
    reminders: reminders.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      kind: r.kind,
      dueDate: iso(r.dueDate),
      dueKm: r.dueKm,
      description: r.description,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      vehicleId: d.vehicleId,
      typeCode: d.documentType.code,
      typeLabel: d.documentType.label,
      title: d.title,
      expiryDate: iso(d.expiryDate),
      addedAt: iso(d.addedAt),
    })),
    projects: projects.map((p) => ({
      id: p.id,
      vehicleId: p.vehicleId,
      name: p.name,
      budget: money(p.budget),
      spent: money(p.spent),
      createdAt: iso(p.createdAt),
      stages: p.stages.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        createdAt: iso(s.createdAt),
        modifications: s.modifications.map((m) => ({ id: m.id, name: m.name, cost: money(m.cost) })),
        parts: s.parts.map((part) => ({
          id: part.id,
          name: part.name,
          cost: money(part.cost),
          supplier: part.supplier,
          date: iso(part.date),
          createdAt: iso(part.createdAt),
        })),
      })),
    })),
    serviceIntervals,
  };
}

// ---------------------------------------------------------------------------
// Workshop snapshot — the work report's input.
// ---------------------------------------------------------------------------

export async function getWorkshopReportData(workshopId: string, account: ReportAccount) {
  const [workshop, conventions] = await Promise.all([
    prisma.workshop.findUniqueOrThrow({
      where: { id: workshopId },
      include: {
        members: { orderBy: { joinedAt: "asc" } },
        customers: { orderBy: { createdAt: "asc" } },
      },
    }),
    getReportConventions(account.region),
  ]);

  const [jobs, estimates, invoices] = await Promise.all([
    prisma.job.findMany({
      where: { workshopId },
      orderBy: { createdAt: "asc" },
      include: {
        lines: { orderBy: { createdAt: "asc" } },
        assignments: { orderBy: { assignedAt: "asc" } },
        statusEvents: { orderBy: { changedAt: "asc" } },
        // Identity only (make/model/plate) — never the owner's history; the
        // job itself already belongs to this workshop.
        vehicle: { select: { id: true, make: true, model: true, plate: true } },
      },
    }),
    prisma.estimate.findMany({
      where: { workshopId },
      orderBy: { createdAt: "asc" },
      include: { items: true, decisions: { orderBy: { decidedAt: "asc" } } },
    }),
    prisma.invoice.findMany({
      where: { workshopId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        items: true,
        payments: { where: { deletedAt: null }, orderBy: { paidAt: "asc" } },
      },
    }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    account: accountSummary(account),
    conventions,
    workshop: { id: workshop.id, name: workshop.name, createdAt: iso(workshop.createdAt) },
    members: workshop.members.map((m) => ({
      id: m.id,
      accountId: m.accountId,
      displayName: m.displayName,
      role: m.role,
      joinedAt: iso(m.joinedAt),
    })),
    customers: workshop.customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      createdAt: iso(c.createdAt),
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      customerId: j.customerId,
      vehicleId: j.vehicleId,
      vehicle: j.vehicle ? { make: j.vehicle.make, model: j.vehicle.model, plate: j.vehicle.plate } : null,
      vehicleDescription: j.vehicleDescription,
      faultDescription: j.faultDescription,
      status: j.status,
      createdAt: iso(j.createdAt),
      updatedAt: iso(j.updatedAt),
      lines: j.lines.map((l) => ({ id: l.id, kind: l.kind, description: l.description, cost: money(l.cost) })),
      assignments: j.assignments.map((a) => ({ workshopMemberId: a.workshopMemberId, assignedAt: iso(a.assignedAt) })),
      statusEvents: j.statusEvents.map((e) => ({ fromStatus: e.fromStatus, toStatus: e.toStatus, changedAt: iso(e.changedAt) })),
    })),
    estimates: estimates.map((e) => ({
      id: e.id,
      jobId: e.jobId,
      vehicleId: e.vehicleId,
      status: e.status,
      total: money(e.total),
      createdAt: iso(e.createdAt),
      items: e.items.map((i) => ({ id: i.id, description: i.description, cost: money(i.cost) })),
      decisions: e.decisions.map((d) => ({ decision: d.decision, decidedAt: iso(d.decidedAt) })),
    })),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      jobId: inv.jobId,
      estimateId: inv.estimateId,
      vehicleId: inv.vehicleId,
      status: inv.status,
      total: money(inv.total),
      dueDate: iso(inv.dueDate),
      createdAt: iso(inv.createdAt),
      items: inv.items.map((i) => ({ id: i.id, description: i.description, cost: money(i.cost) })),
      payments: inv.payments.map((p) => ({ id: p.id, amount: money(p.amount), method: p.method, paidAt: iso(p.paidAt) })),
    })),
  };
}
