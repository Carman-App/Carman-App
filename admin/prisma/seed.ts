/**
 * Seeds the single demo Account/User/Garage that the mobile app's onboarding
 * flow bootstraps against, per AGENTS.md's Identity section: there is no
 * POST /api/v1/account (no real end-user auth yet), so mobile treats
 * onboarding as "first-time setup of this pre-provisioned account" rather
 * than true account creation. The account id is fixed and known
 * (DEV_ACCOUNT_ID in .env / .env.example) so mobile can send it via the
 * x-carma-account-id header from a fresh install.
 *
 * Also seeds the same three sample vehicles the mobile mock data layer
 * (mobile/src/data/seed.ts) used, with a little history on each, so the
 * live API returns recognizable data when spot-checking screens against a
 * real database.
 *
 * Usage: npx tsx prisma/seed.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DEV_ACCOUNT_ID = process.env.DEV_ACCOUNT_ID ?? "00000000-0000-4000-8000-000000000001";
const DEV_USER_ID = "00000000-0000-4000-8000-000000000002";
const DEV_GARAGE_ID = "00000000-0000-4000-8000-000000000003";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.upsert({
      where: { id: DEV_USER_ID },
      update: { email: "wallaceralak@gmail.com", name: "Wallace Ralak" },
      create: { id: DEV_USER_ID, email: "wallaceralak@gmail.com", name: "Wallace Ralak" },
    });

    const account = await prisma.account.upsert({
      where: { id: DEV_ACCOUNT_ID },
      update: { region: "KE" },
      create: { id: DEV_ACCOUNT_ID, userId: user.id, region: "KE" },
    });

    await prisma.accountProfile.upsert({
      where: { accountId_type: { accountId: account.id, type: "OWNER" } },
      update: { isActive: true },
      create: { accountId: account.id, type: "OWNER", isActive: true },
    });

    const garage = await prisma.garage.upsert({
      where: { id: DEV_GARAGE_ID },
      update: { name: "My Garage", location: "Ngong Road, Nairobi" },
      create: {
        id: DEV_GARAGE_ID,
        ownerId: account.id,
        name: "My Garage",
        location: "Ngong Road, Nairobi",
      },
    });

    await prisma.garageMember.upsert({
      where: { garageId_accountId: { garageId: garage.id, accountId: account.id } },
      update: { role: "OWNER", displayName: user.name },
      create: { garageId: garage.id, accountId: account.id, role: "OWNER", displayName: user.name },
    });

    // Document types — mobile's fixed 5-value DocumentType union (see
    // types/domain.ts) maps 1:1 onto these codes (createDocumentSchema
    // accepts a documentTypeCode instead of requiring the mobile app to
    // know server-generated ids).
    const documentTypes: { code: string; label: string }[] = [
      { code: "insurance", label: "Insurance" },
      { code: "logbook", label: "Logbook" },
      { code: "inspection", label: "Inspection" },
      { code: "invoice", label: "Invoice" },
      { code: "receipt", label: "Receipt" },
    ];
    for (const dt of documentTypes) {
      await prisma.documentType.upsert({ where: { code: dt.code }, update: { label: dt.label }, create: dt });
    }

    // Plans — Product overview §06. Limits are structural, so they live on
    // the Plan row and are enforced in src/lib/limits.ts. null = unlimited.
    // Prices are not in the overview and are set per currency from the
    // console (Config → Plans, CFG-02), so the seed never overwrites them.
    const plans = [
      { code: "OWNER_FREE", assistantMonthlyQuota: 20, subject: "OWNER", name: "Free", maxGarages: 1, maxVehicles: 3, maxSeats: 1, maxJobsPerMonth: null, maxStaff: null, features: ["1 garage", "3 vehicles", "Just you", "90 days of history"] },
      { code: "OWNER_PERSONAL", assistantMonthlyQuota: 200, subject: "OWNER", name: "Personal", maxGarages: 2, maxVehicles: null, maxSeats: 3, maxJobsPerMonth: null, maxStaff: null, features: ["2 garages", "Unlimited vehicles", "3 members", "Full history", "CSV export"] },
      { code: "OWNER_PRO", assistantMonthlyQuota: 1000, subject: "OWNER", name: "Pro", maxGarages: null, maxVehicles: null, maxSeats: 10, maxJobsPerMonth: null, maxStaff: null, features: ["Unlimited garages and vehicles", "10 members per garage", "Full history", "CSV export", "Priority support"] },
      { code: "WORKSHOP_FREE", assistantMonthlyQuota: 30, subject: "WORKSHOP", name: "Free", maxGarages: null, maxVehicles: null, maxSeats: null, maxJobsPerMonth: 5, maxStaff: 1, features: ["5 jobs a month"] },
      { code: "WORKSHOP_STANDARD", assistantMonthlyQuota: 500, subject: "WORKSHOP", name: "Workshop", maxGarages: null, maxVehicles: null, maxSeats: null, maxJobsPerMonth: null, maxStaff: 3, features: ["Unlimited jobs", "3 staff"] },
      { code: "WORKSHOP_FLEET", assistantMonthlyQuota: 2000, subject: "WORKSHOP", name: "Fleet", maxGarages: null, maxVehicles: null, maxSeats: null, maxJobsPerMonth: null, maxStaff: 12, features: ["Unlimited jobs", "12 staff", "API access"] },
    ] as const;
    for (const { code, subject, ...limits } of plans) {
      const data = { ...limits, features: [...limits.features] };
      await prisma.plan.upsert({ where: { code }, update: data, create: { code, subject, ...data } });
    }
    // CFG-08 trial and grace rules. Created once; afterwards edited from the console.
    await prisma.subscriptionRules.upsert({ where: { key: "global" }, update: {}, create: { key: "global" } });

    const prado = await upsertVehicle(prisma, {
      id: "00000000-0000-4000-8000-000000000010",
      garageId: garage.id,
      make: "Toyota",
      model: "Land Cruiser Prado",
      year: 2018,
      type: "CAR",
      usage: "DAILY",
      plate: "KDG 441X",
      odometerKm: 84520,
      powertrain: "DIESEL",
      nextServiceDueKm: 90000,
      color: "#1F4FD8",
    });

    const e36 = await upsertVehicle(prisma, {
      id: "00000000-0000-4000-8000-000000000011",
      garageId: garage.id,
      make: "BMW",
      model: "E36 328i",
      year: 1994,
      type: "CAR",
      usage: "PROJECT",
      plate: "KAJ 902B",
      odometerKm: 211300,
      vin: "WBACB61070EM",
      powertrain: "PETROL",
      color: "#C4432E",
    });

    const tenere = await upsertVehicle(prisma, {
      id: "00000000-0000-4000-8000-000000000012",
      garageId: garage.id,
      make: "Yamaha",
      model: "XT660Z Ténéré",
      year: 2015,
      type: "MOTORCYCLE",
      usage: "WEEKEND",
      plate: "KMDE 771",
      odometerKm: 32100,
      powertrain: "PETROL",
      color: "#2E7D32",
    });

    // A little history on the Prado so insights/timeline/reminders have
    // something real to show.
    await prisma.fuelRecord.createMany({
      data: [
        {
          vehicleId: prado.id,
          date: daysAgo(3),
          amount: 6500,
          litres: 45,
          odometerAtEntry: 84400,
          place: "Total Ngong Road",
          enteredByName: "Wallace R",
        },
        {
          vehicleId: prado.id,
          date: daysAgo(20),
          amount: 7000,
          litres: 48,
          odometerAtEntry: 83000,
          place: "Shell Karen",
          enteredByName: "Wallace R",
        },
      ],
      skipDuplicates: true,
    });
    await prisma.serviceRecord.createMany({
      data: [
        {
          vehicleId: prado.id,
          date: daysAgo(45),
          amount: 18500,
          odometerAtEntry: 80000,
          description: "Full service — oil, filters, brake pads",
          place: "Toyota Kenya Service Centre",
          enteredByName: "Wallace R",
        },
      ],
      skipDuplicates: true,
    });
    await prisma.reminder.createMany({
      data: [
        {
          vehicleId: prado.id,
          kind: "SERVICE_DUE",
          dueKm: 90000,
          description: "Next service due at 90,000 km",
        },
        {
          vehicleId: e36.id,
          kind: "DOCUMENT_EXPIRY",
          dueDate: daysFromNow(21),
          description: "Insurance expires in 3 weeks",
        },
      ],
      skipDuplicates: true,
    });

    console.log("Seed complete.");
    console.log(`  DEV_ACCOUNT_ID=${account.id}`);
    console.log(`  Garage: ${garage.id} (${garage.name})`);
    console.log(`  Vehicles: ${prado.id}, ${e36.id}, ${tenere.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function upsertVehicle(
  prisma: PrismaClient,
  data: {
    id: string;
    garageId: string;
    make: string;
    model: string;
    year: number;
    type: "CAR" | "MOTORCYCLE";
    usage: "DAILY" | "PROJECT" | "WEEKEND" | "COMMERCIAL";
    plate: string;
    odometerKm: number;
    vin?: string;
    powertrain?: "PETROL" | "DIESEL" | "HYBRID" | "ELECTRIC";
    nextServiceDueKm?: number;
    color?: string;
  },
) {
  return prisma.vehicle.upsert({
    where: { id: data.id },
    update: data,
    create: data,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
