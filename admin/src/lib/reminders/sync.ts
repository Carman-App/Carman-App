import { prisma } from "@/lib/prisma";
import { BuildStageStatus, EstimateStatus, ReminderKind } from "@/generated/prisma/enums";

/**
 * Reminders were, until this file, a write-once seed fixture
 * (admin/prisma/seed.ts is the ONLY place that ever created a Reminder row —
 * nothing anywhere else in this codebase ever calls `prisma.reminder.create`)
 * rather than something the system actually watches. The product spec is
 * explicit that all four kinds are meant to be system-generated:
 *   "Reminders: Service due by distance or time, document expiry, estimates
 *   awaiting a decision, stalled projects."
 * and mobile's own reminders screen footer already promises this
 * (`mobile/src/app/(tabs)/reminders.tsx`: "Carma sets reminders from your
 * odometer and from document expiry dates").
 *
 * This reconciles a vehicle's real `Reminder` rows against its current data
 * every time reminders are read (see the GET handlers in
 * app/api/v1/vehicles/[id]/reminders and app/api/v1/garages/[id]/reminders),
 * rather than adding a cron/queue dependency this pass is scoped to avoid.
 * It is idempotent and safe to call repeatedly: unresolved reminders whose
 * condition still holds are left untouched, reminders whose condition no
 * longer holds are marked resolved, and reminders for a still-true condition
 * that don't exist yet are created.
 *
 * Known limitation, called out rather than silently assumed: a reminder the
 * owner explicitly resolves (`POST /reminders/:id/resolve`) will be
 * recreated on the next sync if the underlying condition is still true (the
 * odometer is still past `nextServiceDueKm`, the document still hasn't been
 * renewed, ...). Making "resolved" sticky against an unchanged condition
 * would need its own concept (e.g. a per-source snooze) — out of scope for
 * this pass; noted for the product audit.
 */

const SERVICE_DUE_WARNING_KM = 1000;
const DOCUMENT_EXPIRY_WARNING_DAYS = 30;
const PROJECT_STALLED_AFTER_DAYS = 30;

type DesiredReminder = {
  /** Stable natural key so re-running sync doesn't duplicate/re-resolve the same reminder. */
  matchKey: string;
  dueDate?: Date;
  dueKm?: number;
  description: string;
};

function matchKeyOf(kind: ReminderKind, r: { dueDate: Date | null; dueKm: number | null }): string {
  return kind === ReminderKind.SERVICE_DUE ? `km:${r.dueKm}` : `date:${r.dueDate?.toISOString()}`;
}

async function reconcile(vehicleId: string, kind: ReminderKind, desired: DesiredReminder[]): Promise<void> {
  const existing = await prisma.reminder.findMany({ where: { vehicleId, kind, resolved: false } });
  const existingKeys = new Set(existing.map((r) => matchKeyOf(kind, r)));
  const desiredKeys = new Set(desired.map((d) => d.matchKey));

  const staleIds = existing.filter((r) => !desiredKeys.has(matchKeyOf(kind, r))).map((r) => r.id);
  const missing = desired.filter((d) => !existingKeys.has(d.matchKey));

  await Promise.all([
    staleIds.length
      ? prisma.reminder.updateMany({ where: { id: { in: staleIds } }, data: { resolved: true } })
      : Promise.resolve(),
    missing.length
      ? prisma.reminder.createMany({
          data: missing.map((d) => ({
            vehicleId,
            kind,
            dueDate: d.dueDate,
            dueKm: d.dueKm,
            description: d.description,
          })),
        })
      : Promise.resolve(),
  ]);
}

function buildServiceDueDesired(vehicle: { odometerKm: number; nextServiceDueKm: number | null }): DesiredReminder[] {
  if (vehicle.nextServiceDueKm == null) return [];
  if (vehicle.odometerKm < vehicle.nextServiceDueKm - SERVICE_DUE_WARNING_KM) return [];
  return [
    {
      matchKey: `km:${vehicle.nextServiceDueKm}`,
      dueKm: vehicle.nextServiceDueKm,
      description: `Next service due at ${vehicle.nextServiceDueKm.toLocaleString("en-US")} km`,
    },
  ];
}

function buildDocumentExpiryDesired(
  documents: { title: string; expiryDate: Date | null }[],
  warnAtMs: number,
): DesiredReminder[] {
  return documents
    .filter((d): d is { title: string; expiryDate: Date } => d.expiryDate != null && d.expiryDate.getTime() <= warnAtMs)
    .map((d) => ({
      matchKey: `date:${d.expiryDate.toISOString()}`,
      dueDate: d.expiryDate,
      // Absolute date, not a relative "in 3 weeks" — this description is
      // written once and never re-rendered, so a relative phrasing would go
      // stale (see module doc).
      description: `${d.title} expires ${d.expiryDate.toISOString().slice(0, 10)}`,
    }));
}

function buildEstimatePendingDesired(estimates: { createdAt: Date }[]): DesiredReminder[] {
  return estimates.map((e) => ({
    matchKey: `date:${e.createdAt.toISOString()}`,
    dueDate: e.createdAt,
    description: "Estimate awaiting your decision",
  }));
}

/**
 * "Stalled" needs a last-activity timestamp; `ProjectStage` only has
 * `createdAt` (see admin/prisma/schema.prisma), not one that's bumped when a
 * stage's status changes (`PATCH /stages/:id` only writes `ProjectStage`,
 * never touches the parent `Project` row — see
 * app/api/v1/stages/[id]/route.ts). `Project.updatedAt` is therefore only a
 * proxy for "the project record itself was last touched" (e.g. a budget
 * edit), not "a stage moved" — a real implementation would need a schema
 * migration to add per-stage activity tracking. Flagged as a heuristic
 * rather than skipped outright, since some signal beats none for a
 * capability the spec explicitly requires.
 */
function buildProjectStalledDesired(
  projects: { name: string | null; updatedAt: Date; stages: { status: BuildStageStatus }[] }[],
  nowMs: number,
): DesiredReminder[] {
  const staleBefore = nowMs - PROJECT_STALLED_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return projects
    .filter((p) => p.updatedAt.getTime() <= staleBefore && p.stages.some((s) => s.status !== BuildStageStatus.DONE))
    .map((p) => ({
      matchKey: `date:${p.updatedAt.toISOString()}`,
      dueDate: p.updatedAt,
      description: `${p.name ?? "Project build"} hasn't moved in over ${PROJECT_STALLED_AFTER_DAYS} days`,
    }));
}

export async function syncVehicleReminders(vehicleId: string): Promise<void> {
  const [vehicle, documents, pendingEstimates, projects] = await Promise.all([
    prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { odometerKm: true, nextServiceDueKm: true } }),
    prisma.document.findMany({
      where: { vehicleId, deletedAt: null, expiryDate: { not: null } },
      select: { title: true, expiryDate: true },
    }),
    prisma.estimate.findMany({
      where: { vehicleId, status: EstimateStatus.PENDING },
      select: { createdAt: true },
    }),
    prisma.project.findMany({
      where: { vehicleId },
      select: { name: true, updatedAt: true, stages: { select: { status: true } } },
    }),
  ]);
  if (!vehicle) return;

  const now = Date.now();
  const warnAtMs = now + DOCUMENT_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;

  await Promise.all([
    reconcile(vehicleId, ReminderKind.SERVICE_DUE, buildServiceDueDesired(vehicle)),
    reconcile(vehicleId, ReminderKind.DOCUMENT_EXPIRY, buildDocumentExpiryDesired(documents, warnAtMs)),
    reconcile(vehicleId, ReminderKind.ESTIMATE_PENDING, buildEstimatePendingDesired(pendingEstimates)),
    reconcile(vehicleId, ReminderKind.PROJECT_STALLED, buildProjectStalledDesired(projects, now)),
  ]);
}

/** Syncs every vehicle in a garage — used by the garage-level reminders GET. */
export async function syncGarageReminders(garageId: string): Promise<void> {
  const vehicles = await prisma.vehicle.findMany({ where: { garageId }, select: { id: true } });
  await Promise.all(vehicles.map((v) => syncVehicleReminders(v.id)));
}
