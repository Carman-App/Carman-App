/**
 * Test accounts for trying Carma out (usability sessions, QA). Each one is a
 * different situation a real person can be in:
 *
 *   1. Nia      new owner, nothing set up       → walks through set-up
 *   2. Brian    owner with two vehicles and history, a document expiring
 *   3. Amina    member of Brian's garage (shared access, owns nothing)
 *   4. Otieno   mechanic with a workshop, a customer and an open job
 *   5. Grace    trial over, on the Free plan at its 3-vehicle limit
 *
 * Usage (from admin/):
 *   npm run test-accounts            # create, or reset them to this state
 *   npm run test-accounts -- --remove
 *
 * In development the app switches between them from My profile → Test
 * accounts (no Google/Apple sign-in needed). Their emails end in
 * @carma.test; nothing is ever sent to them. Never run this on production.
 */
import "../load-env";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withLibpqSsl } from "../src/lib/db-url";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: withLibpqSsl(process.env.DATABASE_URL ?? "") }) });

const id = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`;
const day = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * day);
const ahead = (d: number) => new Date(Date.now() + d * day);

const PEOPLE = [
  { n: 1, name: "Nia Wambui", email: "nia@carma.test" },
  { n: 2, name: "Brian Ochieng", email: "brian@carma.test" },
  { n: 3, name: "Amina Hassan", email: "amina@carma.test" },
  { n: 4, name: "Otieno Auto Works", email: "otieno@carma.test" },
  { n: 5, name: "Grace Njeri", email: "grace@carma.test" },
] as const;

const accountId = (n: number) => id(n);
const userId = (n: number) => id(100 + n);

async function remove() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@carma.test" } }, select: { id: true } });
  // Deleting the user removes the account and everything it owns.
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  return users.length;
}

async function person(n: number, name: string, email: string, profile: "OWNER" | "MECHANIC" = "OWNER") {
  await prisma.user.create({ data: { id: userId(n), email, name } });
  await prisma.account.create({ data: { id: accountId(n), userId: userId(n), region: "KE" } });
  await prisma.accountProfile.create({ data: { accountId: accountId(n), type: profile, isActive: true } });
}

async function garage(n: number, owner: number, name: string, location: string, ownerName: string) {
  const g = await prisma.garage.create({ data: { id: id(200 + n), ownerId: accountId(owner), name, location } });
  await prisma.garageMember.create({ data: { garageId: g.id, accountId: accountId(owner), role: "OWNER", displayName: ownerName } });
  return g;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set in admin/.env.");
  const removed = await remove();
  if (process.argv.includes("--remove")) {
    console.log(`Removed ${removed} test account(s).`);
    return;
  }
  for (const p of PEOPLE) await person(p.n, p.name, p.email, p.n === 4 ? "MECHANIC" : "OWNER");

  // 2. Brian: a garage with a car and a motorcycle, with history.
  const brianGarage = await garage(2, 2, "Ochieng Family", "Kilimani, Nairobi", "Brian Ochieng");
  const fielder = await prisma.vehicle.create({
    data: { id: id(300), garageId: brianGarage.id, make: "Toyota", model: "Fielder", year: 2016, type: "CAR", usage: "DAILY", plate: "KCX 214M", odometerKm: 128400, powertrain: "PETROL", nextServiceDueKm: 130000 },
  });
  await prisma.vehicle.create({
    data: { id: id(301), garageId: brianGarage.id, make: "Honda", model: "CB 150R", year: 2021, type: "MOTORCYCLE", usage: "WEEKEND", plate: "KMEB 902K", odometerKm: 8400, powertrain: "PETROL" },
  });
  await prisma.fuelRecord.createMany({
    data: [
      { vehicleId: fielder.id, date: ago(2), amount: 4200, litres: 22, odometerAtEntry: 128400, place: "Rubis Argwings Kodhek", enteredByAccountId: accountId(2), enteredByName: "Brian Ochieng" },
      { vehicleId: fielder.id, date: ago(16), amount: 4500, litres: 24, odometerAtEntry: 127900, place: "Total Yaya", enteredByAccountId: accountId(2), enteredByName: "Brian Ochieng" },
      { vehicleId: fielder.id, date: ago(31), amount: 4300, litres: 23, odometerAtEntry: 127350, place: "Shell Kilimani", enteredByAccountId: accountId(2), enteredByName: "Brian Ochieng" },
    ],
  });
  await prisma.serviceRecord.create({
    data: { vehicleId: fielder.id, date: ago(60), amount: 9800, odometerAtEntry: 125200, description: "Oil and filter change, brake check", place: "Kilimani Motors", enteredByAccountId: accountId(2), enteredByName: "Brian Ochieng" },
  });
  const insurance = await prisma.documentType.findUnique({ where: { code: "insurance" } });
  if (insurance) {
    await prisma.document.create({
      data: { vehicleId: fielder.id, documentTypeId: insurance.id, title: "Comprehensive insurance", expiryDate: ahead(20), uploadedByAccountId: accountId(2) },
    });
  }
  await prisma.reminder.create({ data: { vehicleId: fielder.id, kind: "SERVICE_DUE", dueKm: 130000, description: "Service due at 130,000 km" } });

  // 3. Amina: a member of Brian's garage.
  await prisma.garageMember.create({ data: { garageId: brianGarage.id, accountId: accountId(3), role: "MEMBER", displayName: "Amina Hassan", invitedByAccountId: accountId(2) } });

  // 4. Otieno: a workshop with a customer (Brian) and an open job on the Fielder.
  const workshop = await prisma.workshop.create({
    data: { id: id(400), ownerId: accountId(4), name: "Otieno Auto Works", members: { create: { accountId: accountId(4), role: "OWNER", displayName: "Otieno" } } },
  });
  const customer = await prisma.workshopCustomer.create({ data: { workshopId: workshop.id, name: "Brian Ochieng", phone: "+254700000002", linkedAccountId: accountId(2) } });
  const job = await prisma.job.create({
    data: { workshopId: workshop.id, customerId: customer.id, vehicleId: fielder.id, faultDescription: "Squeaking front brakes", status: "IN_PROGRESS" },
  });
  await prisma.jobLine.createMany({
    data: [
      { jobId: job.id, kind: "PART", description: "Front brake pads", cost: 3800 },
      { jobId: job.id, kind: "LABOUR", description: "Fit pads and skim discs", cost: 2500 },
    ],
  });

  // 5. Grace: trial over (Free plan), already at the Free plan's 3 vehicles.
  const graceGarage = await garage(5, 5, "Njeri", "Thika", "Grace Njeri");
  const cars = [
    ["Mazda", "Demio", 2014, "KCB 118T"],
    ["Nissan", "Note", 2015, "KCF 552Q"],
    ["Suzuki", "Swift", 2017, "KCN 730R"],
  ] as const;
  for (const [i, [make, model, year, plate]] of cars.entries()) {
    await prisma.vehicle.create({ data: { id: id(500 + i), garageId: graceGarage.id, make, model, year, type: "CAR", usage: "DAILY", plate, odometerKm: 60000 + i * 15000, powertrain: "PETROL" } });
  }
  const trialPlan = await prisma.plan.findUnique({ where: { code: "OWNER_PRO" } });
  if (trialPlan) {
    await prisma.subscription.create({
      data: { subject: "OWNER", accountId: accountId(5), planId: trialPlan.id, status: "TRIALING", trialStartedAt: ago(10), trialEndsAt: ago(3) },
    });
  }

  console.log("Test accounts ready (emails end in @carma.test):");
  console.log("  Nia Wambui        new owner: set-up from the start");
  console.log("  Brian Ochieng     owner: Toyota Fielder + Honda CB 150R, history, insurance expiring");
  console.log("  Amina Hassan      member of Brian's garage");
  console.log("  Otieno Auto Works mechanic: workshop, customer, open job");
  console.log("  Grace Njeri       trial over, Free plan, at the 3-vehicle limit");
  console.log("\nIn the app (development): My profile → Test accounts.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
