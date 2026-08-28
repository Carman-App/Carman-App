import { prisma } from "@/lib/prisma";

// PRIV-01 — "one-action data export": a real, complete JSON export of every
// row connected to one account. Uses src/lib/accounts/merge.ts's ACCT-08
// traversal (garages owned, garage memberships, vehicle memberships,
// workshops owned, workshop memberships, subscriptions, notifications) as
// the baseline for "everything connected to this account", then goes
// further/deeper for a true export: every vehicle under every garage the
// account owns or belongs to (plus any vehicle it has a direct
// VehicleMembership on outside those garages), and every record/document/
// reminder/project/job/inspection/estimate/invoice/payment reachable through
// those vehicles or workshops.
//
// Deliberately does NOT walk into other surfaces' domains not named in the
// brief (tickets, trust/abuse, messaging/campaigns, feature-flag exposures,
// sync errors) — this stays scoped to the ACCT-08 baseline plus the explicit
// "go deeper" list, not a whole-schema crawl.

function dedupeById<T extends { id: string }>(...lists: T[][]): T[] {
  const map = new Map<string, T>();
  for (const list of lists) {
    for (const item of list) map.set(item.id, item);
  }
  return [...map.values()];
}

export type DataExportPayload = {
  exportedAt: string;
  account: Record<string, unknown>;
  user: Record<string, unknown>;
  profiles: unknown[];
  garagesOwned: unknown[];
  garageMemberships: unknown[];
  vehicleMemberships: unknown[];
  workshopsOwned: unknown[];
  workshopMemberships: unknown[];
  subscriptions: unknown[];
  notifications: unknown[];
  privacyConsents: unknown[];
  vehicles: unknown[];
  fuelRecords: unknown[];
  serviceRecords: unknown[];
  repairRecords: unknown[];
  expenseRecords: unknown[];
  odometerReadings: unknown[];
  documents: unknown[];
  reminders: unknown[];
  projects: unknown[];
  parts: unknown[];
  jobs: unknown[];
  inspections: unknown[];
  estimates: unknown[];
  invoices: unknown[];
  payments: unknown[];
  accessRequests: unknown[];
  accessGrants: unknown[];
  recordCounts: Record<string, number>;
};

export async function buildAccountDataExport(accountId: string): Promise<DataExportPayload | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { user: true, profiles: true },
  });
  if (!account) return null;

  const [garagesOwned, garageMemberships, vehicleMemberships, workshopsOwned, workshopMemberships, subscriptions, notifications, privacyConsents] =
    await Promise.all([
      prisma.garage.findMany({ where: { ownerId: accountId } }),
      prisma.garageMember.findMany({ where: { accountId }, include: { garage: { select: { id: true, name: true } } } }),
      prisma.vehicleMembership.findMany({ where: { accountId }, include: { vehicle: true } }),
      prisma.workshop.findMany({ where: { ownerId: accountId } }),
      prisma.workshopMember.findMany({ where: { accountId }, include: { workshop: { select: { id: true, name: true } } } }),
      prisma.subscription.findMany({ where: { accountId } }),
      prisma.notification.findMany({ where: { accountId } }),
      prisma.privacyConsent.findMany({ where: { accountId } }),
    ]);

  // --- Vehicle universe: every vehicle under every garage owned/member-of,
  // plus any vehicle reachable only via a direct VehicleMembership. ---------
  const garageIdsForVehicles = new Set<string>([
    ...garagesOwned.map((g) => g.id),
    ...garageMemberships.map((gm) => gm.garageId),
  ]);
  const garageVehicles = garageIdsForVehicles.size
    ? await prisma.vehicle.findMany({ where: { garageId: { in: [...garageIdsForVehicles] } } })
    : [];
  const vehicles = dedupeById(garageVehicles, vehicleMemberships.map((vm) => vm.vehicle));
  const vehicleIds = vehicles.map((v) => v.id);

  const [
    fuelRecords,
    serviceRecords,
    repairRecords,
    expenseRecords,
    odometerReadings,
    documents,
    reminders,
    projects,
    parts,
    jobsViaVehicle,
    inspectionsViaVehicle,
    estimatesViaVehicle,
    invoicesViaVehicle,
    accessRequests,
    accessGrants,
  ] = vehicleIds.length
    ? await Promise.all([
        prisma.fuelRecord.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.serviceRecord.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.repairRecord.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.expenseRecord.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.odometerReading.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.document.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.reminder.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.project.findMany({
          where: { vehicleId: { in: vehicleIds } },
          include: { stages: { include: { modifications: true, parts: true } } },
        }),
        prisma.part.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.job.findMany({
          where: { vehicleId: { in: vehicleIds } },
          include: { lines: true, assignments: true, statusEvents: true, customer: true },
        }),
        prisma.inspection.findMany({ where: { vehicleId: { in: vehicleIds } }, include: { items: true } }),
        prisma.estimate.findMany({ where: { vehicleId: { in: vehicleIds } }, include: { items: true, decisions: true } }),
        prisma.invoice.findMany({ where: { vehicleId: { in: vehicleIds } }, include: { items: true, payments: true } }),
        prisma.accessRequest.findMany({ where: { vehicleId: { in: vehicleIds } } }),
        prisma.accessGrant.findMany({ where: { vehicleId: { in: vehicleIds } } }),
      ])
    : [[], [], [], [], [], [], [], [], [], [], [], [], [], [], []];

  // --- Workshop universe: workshops owned or belonged to (mechanic side) —
  // "job (if a mechanic account)" per the brief. Jobs/inspections/estimates/
  // invoices reachable this way are merged with the vehicle-side ones above
  // (a job can touch both a vehicle this account owns AND a workshop this
  // account works at) so nothing is double counted. -----------------------
  const workshopIds = [...new Set([...workshopsOwned.map((w) => w.id), ...workshopMemberships.map((wm) => wm.workshopId)])];

  const [jobsViaWorkshop, inspectionsViaWorkshop, estimatesViaWorkshop, invoicesViaWorkshop] = workshopIds.length
    ? await Promise.all([
        prisma.job.findMany({
          where: { workshopId: { in: workshopIds } },
          include: { lines: true, assignments: true, statusEvents: true, customer: true },
        }),
        prisma.inspection.findMany({ where: { workshopId: { in: workshopIds } }, include: { items: true } }),
        prisma.estimate.findMany({ where: { workshopId: { in: workshopIds } }, include: { items: true, decisions: true } }),
        prisma.invoice.findMany({ where: { workshopId: { in: workshopIds } }, include: { items: true, payments: true } }),
      ])
    : [[], [], [], []];

  const jobs = dedupeById(jobsViaVehicle, jobsViaWorkshop);
  const inspections = dedupeById(inspectionsViaVehicle, inspectionsViaWorkshop);
  const estimates = dedupeById(estimatesViaVehicle, estimatesViaWorkshop);
  const invoices = dedupeById(invoicesViaVehicle, invoicesViaWorkshop);
  const payments = dedupeById(...invoices.map((inv) => inv.payments));

  const recordCounts: Record<string, number> = {
    profiles: account.profiles.length,
    garagesOwned: garagesOwned.length,
    garageMemberships: garageMemberships.length,
    vehicles: vehicles.length,
    vehicleMemberships: vehicleMemberships.length,
    workshopsOwned: workshopsOwned.length,
    workshopMemberships: workshopMemberships.length,
    subscriptions: subscriptions.length,
    notifications: notifications.length,
    privacyConsents: privacyConsents.length,
    fuelRecords: fuelRecords.length,
    serviceRecords: serviceRecords.length,
    repairRecords: repairRecords.length,
    expenseRecords: expenseRecords.length,
    odometerReadings: odometerReadings.length,
    documents: documents.length,
    reminders: reminders.length,
    projects: projects.length,
    parts: parts.length,
    jobs: jobs.length,
    inspections: inspections.length,
    estimates: estimates.length,
    invoices: invoices.length,
    payments: payments.length,
    accessRequests: accessRequests.length,
    accessGrants: accessGrants.length,
  };

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: account.id,
      region: account.region,
      createdAt: account.createdAt,
      suspendedAt: account.suspendedAt,
      deletedAt: account.deletedAt,
      signupSource: account.signupSource,
    },
    user: {
      id: account.user.id,
      name: account.user.name,
      email: account.user.email,
      emailVerifiedAt: account.user.emailVerifiedAt,
    },
    profiles: account.profiles,
    garagesOwned,
    garageMemberships,
    vehicleMemberships,
    workshopsOwned,
    workshopMemberships,
    subscriptions,
    notifications,
    privacyConsents,
    vehicles,
    fuelRecords,
    serviceRecords,
    repairRecords,
    expenseRecords,
    odometerReadings,
    documents,
    reminders,
    projects,
    parts,
    jobs,
    inspections,
    estimates,
    invoices,
    payments,
    accessRequests,
    accessGrants,
    recordCounts,
  };
}
