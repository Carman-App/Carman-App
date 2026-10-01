/**
 * Demo history for the web report (web/) — run AFTER `npm run seed`, which
 * creates the dev account, its garage and the three sample vehicles this
 * script builds on.
 *
 * Adds about fourteen months of owner-side history (fuel, services that land
 * on and off their interval, repairs, insurance and running costs), a second
 * garage member and a former member, an edited record, a late-entered
 * record, a soft-deleted record, a likely duplicate, documents with expiries,
 * a project build for the E36, and a workshop owned by the dev account with
 * staff, customers, jobs, estimates, invoices and payments — enough for every
 * section of the expense and work reports to switch on.
 *
 * Idempotent and current: every row uses a fixed id (prefix `seedrpt-` or
 * the fixed account ids below) and dates are anchored to today, so each run
 * deletes this script's own rows and recreates them — nothing it didn't
 * create is touched, except jobs and customers of the demo workshop it owns.
 *
 * Usage: npm run seed:reports
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import type { JobStatus } from "../src/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";

const DEV_ACCOUNT_ID = process.env.DEV_ACCOUNT_ID ?? "00000000-0000-4000-8000-000000000001";
const DEV_GARAGE_ID = "00000000-0000-4000-8000-000000000003";
const PRADO_ID = "00000000-0000-4000-8000-000000000010";
const E36_ID = "00000000-0000-4000-8000-000000000011";
const TENERE_ID = "00000000-0000-4000-8000-000000000012";

const PEOPLE = {
  amina: { userId: "00000000-0000-4000-8000-000000000101", accountId: "00000000-0000-4000-8000-000000000102", name: "Amina Wanjiru", email: "amina.demo@example.com" },
  brian: { userId: "00000000-0000-4000-8000-000000000103", accountId: "00000000-0000-4000-8000-000000000104", name: "Brian Otieno", email: "brian.demo@example.com" },
  peter: { userId: "00000000-0000-4000-8000-000000000105", accountId: "00000000-0000-4000-8000-000000000106", name: "Peter Kamau", email: "peter.demo@example.com" },
  grace: { userId: "00000000-0000-4000-8000-000000000107", accountId: "00000000-0000-4000-8000-000000000108", name: "Grace Achieng", email: "grace.demo@example.com" },
  fleet: { userId: "00000000-0000-4000-8000-000000000109", accountId: "00000000-0000-4000-8000-000000000110", name: "Workshop customers (demo)", email: "customers.demo@example.com" },
} as const;

const CUSTOMER_GARAGE_ID = "00000000-0000-4000-8000-000000000111";
const WORKSHOP_ID = "00000000-0000-4000-8000-000000000120";
const PROJECT_ID = "seedrpt-project-e36";
const ID_PREFIX = "seedrpt-";

const OWNER_NAME = "Wallace Ralak";

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

/** mulberry32 — tiny seeded PRNG so amounts are stable from run to run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TODAY = (() => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
})();
const DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC `n` days ago — the same date-only convention the apps send. */
function dayUtc(daysAgo: number): Date {
  return new Date(TODAY - daysAgo * DAY);
}

/** A timestamp on the given day (hours after midnight UTC). */
function at(daysAgo: number, hours: number): Date {
  return new Date(TODAY - daysAgo * DAY + hours * 60 * 60 * 1000);
}

const pad = (n: number) => String(n).padStart(3, "0");

type FuelRow = Prisma.FuelRecordCreateManyInput & { id: string; createdAt: Date };

// Prado odometer model: ~66 km/day up to the base seed's 80,000 km service
// 45 days ago, then ~120 km/day to its fills 20 and 3 days ago (83,000 /
// 84,400 km) — so everything this script adds stays monotonic around them.
function pradoOdo(daysAgo: number): number {
  if (daysAgo >= 45) return Math.round(80000 - (daysAgo - 45) * 66);
  return Math.round(80000 + (45 - daysAgo) * 120);
}

function tenereOdo(daysAgo: number): number {
  return Math.round(32100 - daysAgo * 18);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  try {
    const garage = await prisma.garage.findUnique({ where: { id: DEV_GARAGE_ID } });
    const vehicles = await prisma.vehicle.findMany({ where: { id: { in: [PRADO_ID, E36_ID, TENERE_ID] } } });
    if (!garage || vehicles.length !== 3) {
      throw new Error("Base demo data is missing. Run `npm run seed` first, then `npm run seed:reports`.");
    }

    // -- People ---------------------------------------------------------
    for (const person of Object.values(PEOPLE)) {
      await prisma.user.upsert({
        where: { id: person.userId },
        update: { name: person.name, email: person.email },
        create: { id: person.userId, name: person.name, email: person.email },
      });
      await prisma.account.upsert({
        where: { id: person.accountId },
        update: {},
        create: { id: person.accountId, userId: person.userId, region: "KE" },
      });
    }

    const brianRemovedAt = at(90, 10);
    await prisma.garageMember.upsert({
      where: { garageId_accountId: { garageId: DEV_GARAGE_ID, accountId: PEOPLE.amina.accountId } },
      update: { role: "MEMBER", displayName: PEOPLE.amina.name, removedAt: null, joinedAt: at(400, 9) },
      create: { garageId: DEV_GARAGE_ID, accountId: PEOPLE.amina.accountId, role: "MEMBER", displayName: PEOPLE.amina.name, joinedAt: at(400, 9), invitedByAccountId: DEV_ACCOUNT_ID },
    });
    await prisma.garageMember.upsert({
      where: { garageId_accountId: { garageId: DEV_GARAGE_ID, accountId: PEOPLE.brian.accountId } },
      update: { role: "MEMBER", displayName: PEOPLE.brian.name, removedAt: brianRemovedAt, removedReason: "Left the household", joinedAt: at(430, 9) },
      create: { garageId: DEV_GARAGE_ID, accountId: PEOPLE.brian.accountId, role: "MEMBER", displayName: PEOPLE.brian.name, joinedAt: at(430, 9), invitedByAccountId: DEV_ACCOUNT_ID, removedAt: brianRemovedAt, removedReason: "Left the household" },
    });

    // -- Clear this script's previous owner-side rows ---------------------
    const mine = { id: { startsWith: ID_PREFIX } };
    await prisma.$transaction([
      prisma.fuelRecord.deleteMany({ where: mine }),
      prisma.serviceRecord.deleteMany({ where: mine }),
      prisma.repairRecord.deleteMany({ where: mine }),
      prisma.expenseRecord.deleteMany({ where: mine }),
      prisma.odometerReading.deleteMany({ where: mine }),
      prisma.document.deleteMany({ where: mine }),
      prisma.project.deleteMany({ where: { id: PROJECT_ID } }),
    ]);

    type Who = { name: string; accountId: string };
    const wallace: Who = { name: OWNER_NAME, accountId: DEV_ACCOUNT_ID };
    const amina: Who = { name: PEOPLE.amina.name, accountId: PEOPLE.amina.accountId };
    const brian: Who = { name: PEOPLE.brian.name, accountId: PEOPLE.brian.accountId };
    /** Who logged a record on a given day: Brian only while he was a member. */
    const whoFor = (daysAgo: number, i: number): Who => {
      if (daysAgo > 95 && i % 4 === 1) return brian;
      if (i % 3 === 2) return amina;
      return wallace;
    };

    // -- Prado: fuel ---------------------------------------------------------
    const random = rng(441);
    const stations = ["Total Ngong Road", "Shell Karen", "Rubis Langata Road", "Ola Energy Westlands"];
    const pradoFuel: FuelRow[] = [];
    let i = 0;
    let lastOdo = pradoOdo(424);
    for (let d = 420; d >= 31; d -= 9 + Math.floor(random() * 4)) {
      const odo = pradoOdo(d);
      const distance = odo - lastOdo;
      lastOdo = odo;
      const litres = Math.round(distance * 0.118 * (0.95 + random() * 0.1) * 10) / 10;
      const pricePerLitre = 168 + Math.floor(random() * 15);
      const who = whoFor(d, i);
      pradoFuel.push({
        id: `${ID_PREFIX}fuel-prado-${pad(i)}`,
        vehicleId: PRADO_ID,
        date: dayUtc(d),
        amount: Math.round(litres * pricePerLitre),
        litres,
        odometerAtEntry: odo,
        place: stations[i % stations.length],
        enteredByAccountId: who.accountId,
        enteredByName: who.name,
        createdAt: at(d, 8 + (i % 10)),
      });
      i += 1;
    }
    // One edited fill: amount corrected two days after entry.
    pradoFuel[pradoFuel.length - 6] = {
      ...pradoFuel[pradoFuel.length - 6],
      notes: "Amount corrected from the pump receipt",
    };
    const editedFuelId = pradoFuel[pradoFuel.length - 6].id;
    // A likely duplicate: Amina logs the same fill Wallace already logged.
    const dupSource = pradoFuel[pradoFuel.length - 3];
    pradoFuel.push({
      ...dupSource,
      id: `${ID_PREFIX}fuel-prado-dup`,
      enteredByAccountId: amina.accountId,
      enteredByName: amina.name,
      createdAt: new Date(dupSource.createdAt.getTime() + 3 * 60 * 60 * 1000),
    });
    await prisma.fuelRecord.createMany({ data: pradoFuel });
    const editedSource = pradoFuel.find((r) => r.id === editedFuelId)!;
    await prisma.fuelRecord.update({
      where: { id: editedFuelId },
      data: { editedAt: new Date(editedSource.createdAt.getTime() + 2 * DAY) },
    });

    // -- Prado: services (10,000 km interval — on time, then late) ---------
    const serviceLines = (lines: [string, string, number][]) =>
      lines.map(([name, kind, cost]) => `${name} (${kind}, KES ${cost.toLocaleString("en-US")})`).join("; ");
    const pradoServiceA = 348;
    const pradoServiceB = 168; // due at 70,000 km, done at ~71,900 — late by km
    await prisma.serviceRecord.createMany({
      data: [
        {
          id: `${ID_PREFIX}service-prado-000`,
          vehicleId: PRADO_ID,
          date: dayUtc(pradoServiceA),
          amount: 17500,
          odometerAtEntry: 60000,
          description: serviceLines([
            ["Engine oil · 5W-30 synthetic", "fluid", 7000],
            ["Oil filter", "part", 1500],
            ["Fuel filter", "part", 3500],
            ["Labour · 2 hrs", "labour", 5500],
          ]),
          place: "Toyota Kenya Service Centre",
          enteredByAccountId: brian.accountId,
          enteredByName: brian.name,
          createdAt: at(pradoServiceA, 17),
        },
        {
          id: `${ID_PREFIX}service-prado-001`,
          vehicleId: PRADO_ID,
          date: dayUtc(pradoServiceB),
          amount: 21300,
          odometerAtEntry: pradoOdo(pradoServiceB),
          description: serviceLines([
            ["Engine oil · 5W-30 synthetic", "fluid", 7000],
            ["Oil filter", "part", 1500],
            ["Air filter", "part", 2300],
            ["Brake fluid", "fluid", 2500],
            ["Labour · 3 hrs", "labour", 8000],
          ]),
          place: "Toyota Kenya Service Centre",
          enteredByAccountId: wallace.accountId,
          enteredByName: wallace.name,
          // Entered nine days after the service — shows as entered late.
          createdAt: at(pradoServiceB - 9, 20),
        },
      ],
    });

    // -- Prado: repairs ------------------------------------------------------
    await prisma.repairRecord.createMany({
      data: [
        { id: `${ID_PREFIX}repair-prado-000`, vehicleId: PRADO_ID, date: dayUtc(300), amount: 38500, odometerAtEntry: pradoOdo(300), description: "Front shock absorbers replaced (pair)", place: "Kamau Auto Clinic", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(300, 18) },
        { id: `${ID_PREFIX}repair-prado-001`, vehicleId: PRADO_ID, date: dayUtc(201), amount: 1500, odometerAtEntry: pradoOdo(201), description: "Puncture repair and wheel balancing", place: "Tyre Masters Langata", enteredByAccountId: brian.accountId, enteredByName: brian.name, createdAt: at(201, 12) },
        { id: `${ID_PREFIX}repair-prado-002`, vehicleId: PRADO_ID, date: dayUtc(121), amount: 16800, odometerAtEntry: pradoOdo(121), description: "Front brake discs and pads", place: "Kamau Auto Clinic", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(121, 16) },
        { id: `${ID_PREFIX}repair-prado-003`, vehicleId: PRADO_ID, date: dayUtc(61), amount: 14200, odometerAtEntry: pradoOdo(61), description: "Battery replaced — 100Ah", place: "Chloride Exide Karen", enteredByAccountId: amina.accountId, enteredByName: amina.name, createdAt: at(61, 9) },
      ],
    });

    // -- Prado: running costs --------------------------------------------------
    const pradoExpenses: Prisma.ExpenseRecordCreateManyInput[] = [
      { id: `${ID_PREFIX}expense-prado-ins`, vehicleId: PRADO_ID, date: dayUtc(330), amount: 64000, odometerAtEntry: pradoOdo(330), category: "INSURANCE", place: "Jubilee Insurance", notes: "Comprehensive cover — annual renewal", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(330, 11) },
      { id: `${ID_PREFIX}expense-prado-lic`, vehicleId: PRADO_ID, date: dayUtc(150), amount: 3600, odometerAtEntry: pradoOdo(150), category: "OTHER", place: "NTSA", notes: "Motor vehicle inspection fee", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(150, 13) },
    ];
    for (let m = 0; m < 14; m += 1) {
      const d = 400 - m * 30;
      const who = whoFor(d, m);
      pradoExpenses.push({
        id: `${ID_PREFIX}expense-prado-park-${pad(m)}`,
        vehicleId: PRADO_ID,
        date: dayUtc(d),
        amount: 3000,
        odometerAtEntry: pradoOdo(d),
        category: "OTHER",
        place: "Westgate parking",
        notes: "Monthly parking",
        enteredByAccountId: who.accountId,
        enteredByName: who.name,
        createdAt: at(d, 10),
      });
    }
    for (const [k, d] of [75, 52, 33].entries()) {
      pradoExpenses.push({
        id: `${ID_PREFIX}expense-prado-wash-${pad(k)}`,
        vehicleId: PRADO_ID,
        date: dayUtc(d),
        amount: 600,
        odometerAtEntry: pradoOdo(d),
        category: "OTHER",
        place: "Spinners Car Wash",
        notes: "Exterior and interior wash",
        enteredByAccountId: amina.accountId,
        enteredByName: amina.name,
        createdAt: at(d, 15),
      });
    }
    // Soft-deleted: a wash logged twice, removed the next day. Excluded from
    // every total, counted in the reconciliation.
    pradoExpenses.push({
      id: `${ID_PREFIX}expense-prado-deleted`,
      vehicleId: PRADO_ID,
      date: dayUtc(52),
      amount: 600,
      odometerAtEntry: pradoOdo(52),
      category: "OTHER",
      place: "Spinners Car Wash",
      enteredByAccountId: wallace.accountId,
      enteredByName: wallace.name,
      createdAt: at(52, 18),
      deletedAt: at(51, 8),
    });
    await prisma.expenseRecord.createMany({ data: pradoExpenses });

    // -- Ténéré (motorcycle, 6,000 km interval) ------------------------------
    const bikeRandom = rng(771);
    const bikeFuel: FuelRow[] = [];
    let b = 0;
    let lastBikeOdo = tenereOdo(400);
    for (let d = 390; d >= 6; d -= 12 + Math.floor(bikeRandom() * 8)) {
      const odo = tenereOdo(d);
      const litres = Math.round((odo - lastBikeOdo) * 0.052 * 10) / 10;
      lastBikeOdo = odo;
      bikeFuel.push({
        id: `${ID_PREFIX}fuel-tenere-${pad(b)}`,
        vehicleId: TENERE_ID,
        date: dayUtc(d),
        amount: Math.round(litres * (182 + Math.floor(bikeRandom() * 10))),
        litres,
        odometerAtEntry: odo,
        place: stations[(b + 1) % stations.length],
        enteredByAccountId: wallace.accountId,
        enteredByName: wallace.name,
        createdAt: at(d, 7),
      });
      b += 1;
    }
    await prisma.fuelRecord.createMany({ data: bikeFuel });
    await prisma.serviceRecord.create({
      data: { id: `${ID_PREFIX}service-tenere-000`, vehicleId: TENERE_ID, date: dayUtc(140), amount: 8200, odometerAtEntry: tenereOdo(140), description: serviceLines([["Engine oil · 10W-40", "fluid", 3200], ["Oil filter", "part", 900], ["Labour · 1.5 hrs", "labour", 4100]]), place: "Bike Doctor Kilimani", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(140, 18) },
    });
    await prisma.repairRecord.create({
      data: { id: `${ID_PREFIX}repair-tenere-000`, vehicleId: TENERE_ID, date: dayUtc(70), amount: 9500, odometerAtEntry: tenereOdo(70), description: "Chain and sprocket kit", place: "Bike Doctor Kilimani", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(70, 17) },
    });
    await prisma.expenseRecord.create({
      data: { id: `${ID_PREFIX}expense-tenere-ins`, vehicleId: TENERE_ID, date: dayUtc(165), amount: 12500, odometerAtEntry: tenereOdo(165), category: "INSURANCE", place: "APA Insurance", notes: "Third party, fire and theft", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(165, 12) },
    });

    // -- E36 (project car — barely driven) -----------------------------------
    await prisma.odometerReading.createMany({
      data: [
        { id: `${ID_PREFIX}odo-e36-000`, vehicleId: E36_ID, date: dayUtc(260), odometerKm: 211050, enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(260, 9) },
        { id: `${ID_PREFIX}odo-e36-001`, vehicleId: E36_ID, date: dayUtc(20), odometerKm: 211300, enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(20, 9) },
      ],
    });
    await prisma.expenseRecord.createMany({
      data: [
        { id: `${ID_PREFIX}expense-e36-ins`, vehicleId: E36_ID, date: dayUtc(344), amount: 28000, odometerAtEntry: 211000, category: "INSURANCE", place: "Britam", notes: "Agreed-value classic cover", enteredByAccountId: wallace.accountId, enteredByName: wallace.name, createdAt: at(344, 10) },
        { id: `${ID_PREFIX}expense-e36-storage`, vehicleId: E36_ID, date: dayUtc(95), amount: 15000, odometerAtEntry: 211100, category: "OTHER", place: "Karen Car Storage", notes: "Covered storage — quarter", enteredByAccountId: brian.accountId, enteredByName: brian.name, createdAt: at(95, 10) },
      ],
    });

    // -- Documents -------------------------------------------------------------
    const docType = async (code: string) => (await prisma.documentType.findUniqueOrThrow({ where: { code } })).id;
    const [insurance, inspection, logbook] = await Promise.all([docType("insurance"), docType("inspection"), docType("logbook")]);
    await prisma.document.createMany({
      data: [
        { id: `${ID_PREFIX}doc-prado-ins`, vehicleId: PRADO_ID, documentTypeId: insurance, title: "Jubilee comprehensive cover", expiryDate: dayUtc(-35), addedAt: at(330, 12) },
        { id: `${ID_PREFIX}doc-prado-insp`, vehicleId: PRADO_ID, documentTypeId: inspection, title: "NTSA inspection certificate", expiryDate: dayUtc(5), addedAt: at(150, 14) },
        { id: `${ID_PREFIX}doc-prado-log`, vehicleId: PRADO_ID, documentTypeId: logbook, title: "Logbook", addedAt: at(460, 9) },
        { id: `${ID_PREFIX}doc-e36-ins`, vehicleId: E36_ID, documentTypeId: insurance, title: "Britam agreed-value cover", expiryDate: dayUtc(-21), addedAt: at(344, 11) },
        { id: `${ID_PREFIX}doc-tenere-ins`, vehicleId: TENERE_ID, documentTypeId: insurance, title: "APA third party, fire and theft", expiryDate: dayUtc(-200), addedAt: at(165, 13) },
      ],
    });

    // -- E36 project build -------------------------------------------------------
    const stages: { name: string; status: "DONE" | "IN_PROGRESS" | "NOT_STARTED"; parts: [string, number, string, number][]; mods: [string, number][] }[] = [
      {
        name: "Engine rebuild",
        status: "DONE",
        parts: [
          ["Piston set (Mahle)", 68000, "Autoparts Kenya", 240],
          ["Head gasket set", 12500, "Autoparts Kenya", 238],
          ["Timing chain kit", 18000, "Bavarian Spares Nairobi", 236],
        ],
        mods: [["Machining — head skim and bore", 45000], ["Assembly labour", 60000]],
      },
      {
        name: "Suspension refresh",
        status: "IN_PROGRESS",
        parts: [
          ["Coilover kit (KW V1)", 185000, "Bimmerworld via DHL", 90],
          ["Polyurethane bushing set", 24000, "Bavarian Spares Nairobi", 84],
        ],
        mods: [["Four-wheel alignment", 4500]],
      },
      { name: "Paint and body", status: "NOT_STARTED", parts: [], mods: [] },
    ];
    const spent = stages.reduce((s, st) => s + st.parts.reduce((a, p) => a + p[1], 0) + st.mods.reduce((a, m) => a + m[1], 0), 0);
    await prisma.project.create({
      data: {
        id: PROJECT_ID,
        vehicleId: E36_ID,
        name: "E36 328i restomod",
        budget: 850000,
        spent,
        createdAt: at(250, 9),
        stages: {
          create: stages.map((st, si) => ({
            id: `${ID_PREFIX}stage-${si}`,
            name: st.name,
            status: st.status,
            createdAt: at(250 - si, 9),
            modifications: { create: st.mods.map(([name, cost], mi) => ({ id: `${ID_PREFIX}mod-${si}-${mi}`, name, cost })) },
            parts: {
              create: st.parts.map(([name, cost, supplier, d], pi) => ({
                id: `${ID_PREFIX}part-${si}-${pi}`,
                vehicleId: E36_ID,
                name,
                cost,
                supplier,
                date: dayUtc(d),
                createdAt: at(d, 12),
              })),
            },
          })),
        },
      },
    });

    await seedWorkshop(prisma);

    const counts = await Promise.all([
      prisma.fuelRecord.count({ where: mine }),
      prisma.serviceRecord.count({ where: mine }),
      prisma.repairRecord.count({ where: mine }),
      prisma.expenseRecord.count({ where: mine }),
      prisma.job.count({ where: { workshopId: WORKSHOP_ID } }),
    ]);
    console.log("Report demo data complete.");
    console.log(`  Owner records: ${counts[0]} fuel, ${counts[1]} service, ${counts[2]} repair, ${counts[3]} expense`);
    console.log(`  Workshop ${WORKSHOP_ID}: ${counts[4]} jobs`);
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Workshop — owned by the dev account, so the same identity can open both
// the expense report (garage) and the work report (workshop).
// ---------------------------------------------------------------------------

async function seedWorkshop(prisma: PrismaClient) {
  const random = rng(902);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];

  await prisma.workshop.upsert({
    where: { id: WORKSHOP_ID },
    update: { name: "Ralak Motors", ownerId: DEV_ACCOUNT_ID },
    create: { id: WORKSHOP_ID, name: "Ralak Motors", ownerId: DEV_ACCOUNT_ID, createdAt: at(400, 9) },
  });
  const staff = [
    { accountId: DEV_ACCOUNT_ID, role: "OWNER" as const, displayName: OWNER_NAME },
    { accountId: PEOPLE.peter.accountId, role: "MECHANIC" as const, displayName: PEOPLE.peter.name },
    { accountId: PEOPLE.grace.accountId, role: "MECHANIC" as const, displayName: PEOPLE.grace.name },
  ];
  const memberIds: string[] = [];
  for (const s of staff) {
    const member = await prisma.workshopMember.upsert({
      where: { workshopId_accountId: { workshopId: WORKSHOP_ID, accountId: s.accountId } },
      update: { role: s.role, displayName: s.displayName },
      create: { workshopId: WORKSHOP_ID, accountId: s.accountId, role: s.role, displayName: s.displayName, joinedAt: at(400, 9) },
    });
    memberIds.push(member.id);
  }
  const mechanics = memberIds.slice(1);

  // Customer vehicles live in their own demo garage: invoices and estimates
  // require a real Vehicle row (Invoice.vehicleId is non-null).
  await prisma.garage.upsert({
    where: { id: CUSTOMER_GARAGE_ID },
    update: {},
    create: { id: CUSTOMER_GARAGE_ID, ownerId: PEOPLE.fleet.accountId, name: "Workshop customers (demo)", location: "Nairobi" },
  });

  const customers = [
    { name: "Swift Couriers Ltd", phone: "0711 000 101", fleet: [["Toyota", "Probox", "KDA 211K"], ["Toyota", "Probox", "KDB 732M"], ["Nissan", "NV200", "KDC 090P"]] },
    { name: "Mary Njeri", phone: "0722 000 102", fleet: [["Mazda", "Demio", "KCZ 418T"]] },
    { name: "John Mwangi", phone: "0733 000 103", fleet: [["Subaru", "Forester", "KCR 551A"]] },
    { name: "Fatuma Hassan", phone: "0744 000 104", fleet: [["Honda", "Fit", "KDE 300L"]] },
    { name: "Karen Tours & Safaris", phone: "0755 000 105", fleet: [["Toyota", "Land Cruiser 76", "KBX 902S"], ["Toyota", "HiAce", "KCN 117Q"]] },
    { name: "David Ochieng", phone: "0766 000 106", fleet: [["Volkswagen", "Golf", "KCU 640G"]] },
    { name: "Lucy Wambui", phone: "0777 000 107", fleet: [["Toyota", "Vitz", "KDF 228B"]] },
    { name: "Ahmed Abdi", phone: "0788 000 108", fleet: [["Mitsubishi", "Outlander", "KCH 371J"]] },
  ] as const;

  // Clear the workshop's jobs (cascades lines, assignments, estimates,
  // invoices, payments, status events) and customers, then recreate.
  await prisma.job.deleteMany({ where: { workshopId: WORKSHOP_ID } });
  await prisma.workshopCustomer.deleteMany({ where: { workshopId: WORKSHOP_ID } });

  type CustomerRow = { id: string; vehicles: string[] };
  const customerRows: CustomerRow[] = [];
  let vehicleIndex = 0;
  for (const [ci, c] of customers.entries()) {
    const row = await prisma.workshopCustomer.create({
      data: { id: `${ID_PREFIX}customer-${pad(ci)}`, workshopId: WORKSHOP_ID, name: c.name, phone: c.phone, createdAt: at(380 - ci * 20, 10) },
    });
    const vehicleIds: string[] = [];
    for (const [make, model, plate] of c.fleet) {
      const id = `00000000-0000-4000-8000-000000000${String(130 + vehicleIndex).padStart(3, "0")}`;
      vehicleIndex += 1;
      await prisma.vehicle.upsert({
        where: { id },
        update: { make, model, plate },
        create: { id, garageId: CUSTOMER_GARAGE_ID, make, model, plate, year: 2014 + (vehicleIndex % 8), odometerKm: 60000 + vehicleIndex * 9000 },
      });
      vehicleIds.push(id);
    }
    customerRows.push({ id: row.id, vehicles: vehicleIds });
  }

  // Job templates: fault + lines [kind, description, cost].
  const templates: { fault: string; lines: ["SERVICE" | "PART" | "LABOUR" | "FLUID", string, number][] }[] = [
    { fault: "Minor service due", lines: [["FLUID", "Engine oil 5W-30", 6500], ["PART", "Oil filter", 1400], ["LABOUR", "Service labour", 3500]] },
    { fault: "Major service — 100,000 km", lines: [["FLUID", "Engine oil 5W-30", 6500], ["PART", "Oil, air and fuel filters", 5200], ["PART", "Spark plugs (set of 4)", 4800], ["LABOUR", "Service labour", 7500]] },
    { fault: "Squealing brakes", lines: [["PART", "Front brake pads", 6800], ["LABOUR", "Brake service", 3000]] },
    { fault: "Knocking from front suspension", lines: [["PART", "Stabiliser link (pair)", 5600], ["PART", "Lower arm bushes", 7200], ["LABOUR", "Suspension labour", 6000]] },
    { fault: "Engine warning light on", lines: [["SERVICE", "Diagnostic scan", 2500], ["PART", "Oxygen sensor", 9800], ["LABOUR", "Sensor replacement", 2000]] },
    { fault: "Battery not holding charge", lines: [["SERVICE", "Charging system test", 1500], ["PART", "Battery 70Ah", 11500]] },
    { fault: "Overheating in traffic", lines: [["PART", "Thermostat", 3800], ["FLUID", "Coolant", 2400], ["LABOUR", "Cooling system labour", 4500]] },
    { fault: "Clutch slipping", lines: [["PART", "Clutch kit", 24500], ["LABOUR", "Gearbox out and in", 12000]] },
  ];

  const methods = ["CASH", "MOBILE_MONEY", "MOBILE_MONEY", "BANK_TRANSFER"] as const;
  // Customer weights — Swift Couriers is the big account (revenue concentration).
  const customerWeights = [0, 0, 0, 0, 1, 1, 2, 3, 4, 4, 5, 6, 7];

  let jobSeq = 0;
  for (let d = 178; d >= 1; d -= 3 + Math.floor(random() * 3)) {
    const ci = pick(customerWeights);
    const customer = customerRows[ci];
    const vehicleId = pick(customer.vehicles);
    const template = pick(templates);
    const jobId = `${ID_PREFIX}job-${pad(jobSeq)}`;
    const createdAt = at(d, 8 + Math.floor(random() * 3));
    const turnaround = 1 + Math.floor(random() * (template.lines.length > 2 ? 5 : 3));
    const mechanic = mechanics[jobSeq % mechanics.length];
    const declined = jobSeq % 11 === 5;
    const stillOpen = d <= turnaround;
    jobSeq += 1;

    const lines = template.lines.map(([kind, description, cost], li) => ({
      id: `${jobId}-line-${li}`,
      kind,
      description,
      cost: Math.round(cost * (0.9 + random() * 0.25)),
    }));
    const total = lines.reduce((s, l) => s + l.cost, 0);

    const estimateStatus = declined ? "DECLINED" : jobSeq % 13 === 7 ? "PENDING" : "APPROVED";
    const status = declined
      ? "DECLINED"
      : estimateStatus === "PENDING"
        ? "AWAITING_APPROVAL"
        : stillOpen
          ? "IN_PROGRESS"
          : "INVOICED"; // refined below once payments are known

    await prisma.job.create({
      data: {
        id: jobId,
        workshopId: WORKSHOP_ID,
        customerId: customer.id,
        vehicleId,
        faultDescription: template.fault,
        status,
        createdAt,
        lines: { create: lines.map((l) => ({ ...l, createdAt })) },
        assignments: { create: { workshopMemberId: mechanic, assignedAt: createdAt } },
      },
    });

    // Estimate (a declined one keeps one line approved-in-principle out of it).
    const estimateId = `${jobId}-estimate`;
    const estimateCreated = new Date(createdAt.getTime() + 3 * 60 * 60 * 1000);
    await prisma.estimate.create({
      data: {
        id: estimateId,
        jobId,
        vehicleId,
        workshopId: WORKSHOP_ID,
        status: estimateStatus,
        total,
        createdAt: estimateCreated,
        items: { create: lines.map((l, li) => ({ id: `${estimateId}-item-${li}`, description: l.description, cost: l.cost })) },
        decisions:
          estimateStatus === "PENDING"
            ? undefined
            : { create: { decision: estimateStatus === "APPROVED" ? "APPROVED" : "DECLINED", decidedAt: new Date(estimateCreated.getTime() + 2 * 60 * 60 * 1000) } },
      },
    });

    const events: { fromStatus: JobStatus | null; toStatus: JobStatus; changedAt: Date }[] = [
      { fromStatus: null, toStatus: "INTAKE", changedAt: createdAt },
      { fromStatus: "INTAKE", toStatus: "AWAITING_APPROVAL", changedAt: estimateCreated },
    ];

    if (declined || estimateStatus === "PENDING") {
      if (declined) events.push({ fromStatus: "AWAITING_APPROVAL", toStatus: "DECLINED", changedAt: new Date(estimateCreated.getTime() + 2 * 60 * 60 * 1000) });
      await prisma.jobStatusEvent.createMany({ data: events.map((e) => ({ ...e, jobId })) });
      continue;
    }

    events.push({ fromStatus: "AWAITING_APPROVAL", toStatus: "APPROVED", changedAt: new Date(estimateCreated.getTime() + 2 * 60 * 60 * 1000) });
    events.push({ fromStatus: "APPROVED", toStatus: "IN_PROGRESS", changedAt: new Date(estimateCreated.getTime() + 4 * 60 * 60 * 1000) });

    if (stillOpen) {
      await prisma.jobStatusEvent.createMany({ data: events.map((e) => ({ ...e, jobId })) });
      continue;
    }

    const invoicedAt = at(d - turnaround, 15);
    events.push({ fromStatus: "IN_PROGRESS", toStatus: "READY_FOR_COLLECTION", changedAt: new Date(invoicedAt.getTime() - 60 * 60 * 1000) });
    events.push({ fromStatus: "READY_FOR_COLLECTION", toStatus: "INVOICED", changedAt: invoicedAt });

    // Payment behaviour: most pay at collection; some part-pay; a few owe.
    const roll = random();
    const daysSinceInvoice = d - turnaround;
    const payments: { amount: number; method: (typeof methods)[number]; paidAt: Date }[] = [];
    if (roll < 0.72 || daysSinceInvoice < 3) {
      payments.push({ amount: total, method: pick(methods), paidAt: new Date(invoicedAt.getTime() + 60 * 60 * 1000) });
    } else if (roll < 0.86) {
      const part = Math.round(total * 0.5);
      payments.push({ amount: part, method: pick(methods), paidAt: new Date(invoicedAt.getTime() + 60 * 60 * 1000) });
    }
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const invoiceStatus = paid >= total ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
    const jobStatus = invoiceStatus === "PAID" ? "PAID" : invoiceStatus === "PARTIALLY_PAID" ? "PARTIALLY_PAID" : "INVOICED";
    if (invoiceStatus === "PAID") events.push({ fromStatus: "INVOICED", toStatus: "PAID", changedAt: payments[payments.length - 1].paidAt });
    if (invoiceStatus === "PARTIALLY_PAID") events.push({ fromStatus: "INVOICED", toStatus: "PARTIALLY_PAID", changedAt: payments[0].paidAt });

    const invoiceId = `${jobId}-invoice`;
    await prisma.invoice.create({
      data: {
        id: invoiceId,
        jobId,
        estimateId,
        vehicleId,
        workshopId: WORKSHOP_ID,
        status: invoiceStatus,
        total,
        dueDate: new Date(invoicedAt.getTime() + 14 * DAY),
        createdAt: invoicedAt,
        items: { create: lines.map((l, li) => ({ id: `${invoiceId}-item-${li}`, description: l.description, cost: l.cost })) },
        payments: { create: payments.map((p, pi) => ({ id: `${invoiceId}-payment-${pi}`, ...p })) },
      },
    });
    await prisma.job.update({ where: { id: jobId }, data: { status: jobStatus } });
    await prisma.jobStatusEvent.createMany({ data: events.map((e) => ({ ...e, jobId })) });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
