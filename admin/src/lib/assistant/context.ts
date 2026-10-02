import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Builds the plain-text snapshot of a garage (or a workshop) that the
 * assistant answers from. Everything is read-only and scoped to data the
 * caller is already authorised to see — the route checks membership first.
 *
 * Kept as compact text rather than JSON: it is cheaper in tokens and reads
 * naturally for the model. Amounts are in the account's own currency.
 */

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "—");
const money = (v: unknown) => Math.round(Number(v));
const RECORD_LIMIT = 400;

export async function buildGarageContext(garageId: string, today: Date): Promise<string> {
  const since = new Date(today);
  since.setMonth(since.getMonth() - 24);

  const garage = await prisma.garage.findUniqueOrThrow({
    where: { id: garageId },
    select: { name: true, location: true },
  });
  const vehicles = await prisma.vehicle.findMany({
    where: { garageId },
    select: {
      id: true, make: true, model: true, year: true, plate: true, usage: true, type: true,
      odometerKm: true, powertrain: true, nextServiceDueKm: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const ids = vehicles.map((v) => v.id);
  const recordWhere = { vehicleId: { in: ids }, date: { gte: since }, deletedAt: null };

  const [fuel, service, repair, expense, odometer, reminders, documents, estimates] = await Promise.all([
    prisma.fuelRecord.findMany({ where: recordWhere, orderBy: { date: "desc" }, take: RECORD_LIMIT }),
    prisma.serviceRecord.findMany({ where: recordWhere, orderBy: { date: "desc" }, take: RECORD_LIMIT }),
    prisma.repairRecord.findMany({ where: recordWhere, orderBy: { date: "desc" }, take: RECORD_LIMIT }),
    prisma.expenseRecord.findMany({ where: recordWhere, orderBy: { date: "desc" }, take: RECORD_LIMIT }),
    prisma.odometerReading.findMany({ where: { vehicleId: { in: ids }, date: { gte: since } }, orderBy: { date: "desc" }, take: RECORD_LIMIT }),
    prisma.reminder.findMany({ where: { vehicleId: { in: ids }, resolved: false } }),
    prisma.document.findMany({ where: { vehicleId: { in: ids }, deletedAt: null }, include: { documentType: true } }),
    prisma.estimate.findMany({
      where: { vehicleId: { in: ids }, status: "PENDING" },
      include: { workshop: { select: { name: true } }, items: true },
    }),
  ]);

  const name = new Map(vehicles.map((v) => [v.id, `${v.make} ${v.model}`]));
  const lines: string[] = [];
  lines.push(`Garage: ${garage.name}${garage.location ? ` (${garage.location})` : ""}`);
  lines.push("", "Vehicles (id | vehicle | year | plate | usage | odometer km | powertrain | next service km):");
  for (const v of vehicles) {
    lines.push(`${v.id} | ${v.make} ${v.model} | ${v.year} | ${v.plate === "UNASSIGNED" ? "no plate" : v.plate} | ${v.usage} | ${v.odometerKm} | ${v.powertrain ?? "—"} | ${v.nextServiceDueKm ?? "—"}`);
  }

  type Row = { date: Date; text: string };
  const rows: Row[] = [
    ...fuel.map((r) => ({ date: r.date, text: `fuel | ${name.get(r.vehicleId)} | ${money(r.amount)} | ${r.litres ? Number(r.litres) : "—"} L | odo ${r.odometerAtEntry} | ${r.place ?? "—"} | by ${r.enteredByName}` })),
    ...service.map((r) => ({ date: r.date, text: `service | ${name.get(r.vehicleId)} | ${money(r.amount)} | odo ${r.odometerAtEntry} | ${r.place ?? "—"} | ${r.description ?? r.notes ?? ""} | by ${r.enteredByName}` })),
    ...repair.map((r) => ({ date: r.date, text: `repair | ${name.get(r.vehicleId)} | ${money(r.amount)} | odo ${r.odometerAtEntry} | ${r.place ?? "—"} | ${r.description ?? r.notes ?? ""} | by ${r.enteredByName}` })),
    ...expense.map((r) => ({ date: r.date, text: `expense:${r.category.toLowerCase()} | ${name.get(r.vehicleId)} | ${money(r.amount)} | odo ${r.odometerAtEntry} | ${r.place ?? "—"} | ${r.notes ?? ""} | by ${r.enteredByName}` })),
    ...odometer.map((r) => ({ date: r.date, text: `odometer reading | ${name.get(r.vehicleId)} | ${r.odometerKm} km | by ${r.enteredByName}` })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  lines.push("", `Records, newest first, last 24 months (date | kind | vehicle | amount | ...): ${rows.length} rows`);
  for (const r of rows.slice(0, RECORD_LIMIT)) lines.push(`${day(r.date)} | ${r.text}`);

  lines.push("", "Open reminders (vehicle | kind | due date | due km | description):");
  for (const r of reminders) lines.push(`${name.get(r.vehicleId)} | ${r.kind} | ${day(r.dueDate)} | ${r.dueKm ?? "—"} | ${r.description}`);
  if (reminders.length === 0) lines.push("none");

  lines.push("", "Documents (vehicle | type | title | expiry):");
  for (const d of documents) lines.push(`${name.get(d.vehicleId)} | ${d.documentType.label} | ${d.title} | ${day(d.expiryDate)}`);
  if (documents.length === 0) lines.push("none");

  lines.push("", "Estimates waiting on the owner (vehicle | workshop | total | items):");
  for (const e of estimates) lines.push(`${name.get(e.vehicleId)} | ${e.workshop.name} | ${money(e.total)} | ${e.items.map((i) => i.description).join("; ")}`);
  if (estimates.length === 0) lines.push("none");

  return lines.join("\n");
}

export async function buildWorkshopContext(workshopId: string): Promise<string> {
  const workshop = await prisma.workshop.findUniqueOrThrow({ where: { id: workshopId }, select: { name: true } });
  const jobs = await prisma.job.findMany({
    where: { workshopId },
    include: { customer: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const lines: string[] = [`Workshop: ${workshop.name}`, "", "Jobs, newest first (job id | opened | updated | status | customer | vehicle | reported problem):"];
  for (const j of jobs) {
    lines.push(`${j.id} | ${day(j.createdAt)} | ${day(j.updatedAt)} | ${j.status} | ${j.customer.name}${j.customer.phone ? ` (${j.customer.phone})` : ""} | ${j.vehicleDescription ?? "—"} | ${j.faultDescription}`);
    for (const l of j.lines) lines.push(`    line | ${l.kind} | ${l.description} | ${money(l.cost)} | ${day(l.createdAt)}`);
  }
  if (jobs.length === 0) lines.push("none");
  return lines.join("\n");
}
