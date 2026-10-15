/**
 * Demo data for local development and staging. Refuses to run in production.
 * Idempotent for accounts; vehicles are only created when the demo sellers have none.
 *
 * Images are placeholders (placehold.co) for development only.
 */
import type { Types } from "mongoose";
import { countyOf, slugify, vehicleTitle, type BodyType, type Condition, type FuelType } from "@showrooms/shared";
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { env } from "../src/config/env";
import { logger } from "../src/config/logger";
import { hashPassword } from "../src/modules/auth/password";
import { BrokerProfile } from "../src/modules/brokers/broker-profile.model";
import { ensureDefaultCategories } from "../src/modules/categories/categories.routes";
import { DealerProfile } from "../src/modules/dealers/dealer-profile.model";
import { VehicleInquiry } from "../src/modules/inquiries/inquiry.model";
import { createBrokerProfile, createDealerProfile } from "../src/modules/sellers/seller-context";
import { getSettings } from "../src/modules/settings/settings.service";
import { ensureDefaultPlans } from "../src/modules/subscriptions/plans";
import { User } from "../src/modules/users/user.model";
import { ContactClick, VehicleView } from "../src/modules/vehicles/vehicle-events.model";
import { Vehicle } from "../src/modules/vehicles/vehicle.model";
import { eatDay, fingerprint, refreshListingCount } from "../src/modules/vehicles/vehicles.service";
import { shortId } from "../src/utils/slug";

if (env.APP_ENV === "production") throw new Error("Refusing to seed a production database");

const DEMO_PASSWORD = "Showroom2026";

type Seller = { name: string; email: string; phone: string; town: string; kind: "BROKER" | "DEALER"; verified: boolean; bio: string };
const SELLERS: Seller[] = [
  { name: "Otieno Motors", email: "broker@showrooms.test", phone: "+254722000003", town: "Nairobi", kind: "BROKER", verified: true, bio: "Japanese imports and clean local units since 2014. Viewing along Ngong Road." },
  { name: "Kamau Car Deals", email: "kamau@showrooms.test", phone: "+254722100200", town: "Nakuru", kind: "BROKER", verified: true, bio: "Family cars and pickups for the Rift Valley. Trade-ins welcome." },
  { name: "Achieng Autos", email: "achieng@showrooms.test", phone: "+254733400500", town: "Kisumu", kind: "BROKER", verified: false, bio: "Affordable first cars around Kisumu and Kakamega." },
  { name: "Kiprop Wheels", email: "kiprop@showrooms.test", phone: "+254711600700", town: "Eldoret", kind: "BROKER", verified: true, bio: "4x4s, Probox and farm-ready pickups in Eldoret." },
  { name: "Mwangi Imports", email: "mwangi@showrooms.test", phone: "+254700800900", town: "Thika", kind: "BROKER", verified: false, bio: "Direct imports from Japan and the UK. Cars on the ship listed early." },
  { name: "Coast Auto Dealers", email: "dealer@showrooms.test", phone: "+254733000004", town: "Mombasa", kind: "DEALER", verified: true, bio: "Mombasa yard on Moi Avenue. Bonded and locally used stock." },
  { name: "Westlands Premium Cars", email: "premium@showrooms.test", phone: "+254720111222", town: "Nairobi", kind: "DEALER", verified: true, bio: "Premium German and SUV stock in Westlands." },
];

type Spec = [make: string, model: string, year: number, price: number, mileage: number, body: BodyType, fuel: FuelType, cc: number, drive: "FWD" | "RWD" | "AWD" | "FOUR_WD", color: string, condition: Condition];
const SPECS: Spec[] = [
  ["Toyota", "Fielder", 2017, 1_450_000, 86_000, "STATION_WAGON", "PETROL", 1500, "FWD", "Silver", "FOREIGN_USED"],
  ["Toyota", "Axio", 2016, 1_350_000, 92_000, "SEDAN", "PETROL", 1500, "FWD", "Pearl white", "FOREIGN_USED"],
  ["Toyota", "Premio", 2018, 2_150_000, 64_000, "SEDAN", "PETROL", 1800, "FWD", "Black", "FOREIGN_USED"],
  ["Toyota", "Vitz", 2015, 820_000, 98_000, "HATCHBACK", "PETROL", 1000, "FWD", "Red", "LOCALLY_USED"],
  ["Toyota", "Probox", 2016, 980_000, 140_000, "STATION_WAGON", "PETROL", 1500, "FWD", "White", "LOCALLY_USED"],
  ["Toyota", "Harrier", 2017, 3_600_000, 71_000, "SUV", "PETROL", 2000, "AWD", "Black", "FOREIGN_USED"],
  ["Toyota", "Land Cruiser Prado", 2016, 6_200_000, 110_000, "SUV", "DIESEL", 2800, "FOUR_WD", "Grey", "LOCALLY_USED"],
  ["Toyota", "Land Cruiser Prado", 2019, 8_900_000, 58_000, "SUV", "DIESEL", 2800, "FOUR_WD", "Pearl white", "FOREIGN_USED"],
  ["Toyota", "Hilux", 2018, 4_300_000, 95_000, "PICKUP", "DIESEL", 2400, "FOUR_WD", "White", "LOCALLY_USED"],
  ["Toyota", "Noah", 2016, 1_850_000, 88_000, "MINIVAN", "PETROL", 2000, "FWD", "Silver", "FOREIGN_USED"],
  ["Toyota", "Mark X", 2016, 2_350_000, 79_000, "SEDAN", "PETROL", 2500, "RWD", "Dark blue", "FOREIGN_USED"],
  ["Toyota", "Aqua", 2017, 1_250_000, 74_000, "HATCHBACK", "HYBRID", 1500, "FWD", "Blue", "FOREIGN_USED"],
  ["Toyota", "RAV4", 2019, 4_100_000, 49_000, "SUV", "PETROL", 2000, "AWD", "Grey", "FOREIGN_USED"],
  ["Nissan", "Note", 2017, 890_000, 81_000, "HATCHBACK", "PETROL", 1200, "FWD", "White", "FOREIGN_USED"],
  ["Nissan", "X-Trail", 2016, 2_200_000, 96_000, "SUV", "PETROL", 2000, "AWD", "Black", "FOREIGN_USED"],
  ["Nissan", "Navara", 2017, 3_200_000, 120_000, "PICKUP", "DIESEL", 2500, "FOUR_WD", "Silver", "LOCALLY_USED"],
  ["Nissan", "Juke", 2015, 1_150_000, 90_000, "SUV", "PETROL", 1500, "FWD", "Orange", "FOREIGN_USED"],
  ["Mazda", "Demio", 2017, 980_000, 70_000, "HATCHBACK", "PETROL", 1300, "FWD", "Red", "FOREIGN_USED"],
  ["Mazda", "CX-5", 2017, 2_850_000, 77_000, "SUV", "DIESEL", 2200, "AWD", "Soul red", "FOREIGN_USED"],
  ["Mazda", "Atenza", 2016, 1_950_000, 83_000, "SEDAN", "PETROL", 2000, "FWD", "Grey", "FOREIGN_USED"],
  ["Subaru", "Forester", 2016, 2_300_000, 91_000, "SUV", "PETROL", 2000, "AWD", "Green", "FOREIGN_USED"],
  ["Subaru", "Outback", 2016, 2_600_000, 86_000, "STATION_WAGON", "PETROL", 2500, "AWD", "Blue", "FOREIGN_USED"],
  ["Subaru", "Impreza", 2017, 1_600_000, 69_000, "HATCHBACK", "PETROL", 1600, "AWD", "White", "FOREIGN_USED"],
  ["Subaru", "Legacy", 2015, 1_450_000, 102_000, "STATION_WAGON", "PETROL", 2500, "AWD", "Silver", "LOCALLY_USED"],
  ["Honda", "Fit", 2017, 1_050_000, 66_000, "HATCHBACK", "HYBRID", 1500, "FWD", "Blue", "FOREIGN_USED"],
  ["Honda", "Vezel", 2016, 2_100_000, 74_000, "SUV", "HYBRID", 1500, "FWD", "Red", "FOREIGN_USED"],
  ["Honda", "CR-V", 2017, 3_100_000, 81_000, "SUV", "PETROL", 2400, "AWD", "White", "FOREIGN_USED"],
  ["Mitsubishi", "Outlander", 2017, 2_650_000, 79_000, "SUV", "PETROL", 2400, "AWD", "Black", "FOREIGN_USED"],
  ["Mitsubishi", "Pajero", 2015, 3_400_000, 128_000, "SUV", "DIESEL", 3200, "FOUR_WD", "Silver", "LOCALLY_USED"],
  ["Volkswagen", "Golf", 2016, 1_750_000, 72_000, "HATCHBACK", "PETROL", 1400, "FWD", "White", "FOREIGN_USED"],
  ["Volkswagen", "Tiguan", 2017, 3_200_000, 68_000, "SUV", "PETROL", 2000, "AWD", "Grey", "FOREIGN_USED"],
  ["Volkswagen", "Touareg", 2015, 4_500_000, 99_000, "SUV", "DIESEL", 3000, "AWD", "Black", "LOCALLY_USED"],
  ["Mercedes-Benz", "C-Class", 2016, 3_400_000, 64_000, "SEDAN", "PETROL", 2000, "RWD", "Black", "FOREIGN_USED"],
  ["Mercedes-Benz", "E-Class", 2017, 5_200_000, 58_000, "SEDAN", "PETROL", 2000, "RWD", "Silver", "FOREIGN_USED"],
  ["Mercedes-Benz", "GLE", 2018, 9_800_000, 45_000, "SUV", "DIESEL", 3000, "AWD", "Black", "FOREIGN_USED"],
  ["BMW", "3 Series", 2016, 2_900_000, 71_000, "SEDAN", "PETROL", 2000, "RWD", "White", "FOREIGN_USED"],
  ["BMW", "X5", 2016, 6_400_000, 82_000, "SUV", "DIESEL", 3000, "AWD", "Black", "FOREIGN_USED"],
  ["Audi", "Q5", 2017, 4_700_000, 66_000, "SUV", "PETROL", 2000, "AWD", "Grey", "FOREIGN_USED"],
  ["Land Rover", "Range Rover Sport", 2016, 9_500_000, 88_000, "SUV", "DIESEL", 3000, "FOUR_WD", "Black", "LOCALLY_USED"],
  ["Land Rover", "Discovery Sport", 2017, 5_300_000, 70_000, "SUV", "DIESEL", 2000, "AWD", "White", "FOREIGN_USED"],
  ["Isuzu", "D-Max", 2019, 3_900_000, 76_000, "PICKUP", "DIESEL", 3000, "FOUR_WD", "White", "NEW"],
  ["Isuzu", "D-Max", 2017, 2_700_000, 132_000, "PICKUP", "DIESEL", 2500, "RWD", "Silver", "LOCALLY_USED"],
  ["Suzuki", "Swift", 2018, 1_100_000, 52_000, "HATCHBACK", "PETROL", 1200, "FWD", "Red", "FOREIGN_USED"],
  ["Suzuki", "Jimny", 2020, 3_300_000, 28_000, "SUV", "PETROL", 1500, "FOUR_WD", "Green", "FOREIGN_USED"],
  ["Ford", "Ranger", 2018, 4_200_000, 89_000, "PICKUP", "DIESEL", 3200, "FOUR_WD", "Blue", "LOCALLY_USED"],
  ["Lexus", "RX", 2016, 5_900_000, 77_000, "SUV", "HYBRID", 3500, "AWD", "Pearl white", "FOREIGN_USED"],
  ["Toyota", "Hiace", 2015, 2_800_000, 210_000, "VAN", "DIESEL", 3000, "RWD", "White", "LOCALLY_USED"],
  ["Toyota", "Sienta", 2017, 1_500_000, 63_000, "MINIVAN", "HYBRID", 1500, "FWD", "Silver", "FOREIGN_USED"],
];

const AREAS: Record<string, string[]> = {
  Nairobi: ["Westlands", "Ngong Road", "Kilimani", "Karen", "Mombasa Road"],
  Mombasa: ["Nyali", "Moi Avenue", "Bamburi"],
  Kisumu: ["Milimani", "Mamboleo"],
  Nakuru: ["Milimani", "Section 58"],
  Eldoret: ["Elgon View", "Town centre"],
  Thika: ["Makongeni", "Town centre"],
};

const placeholder = (title: string, i: number) => ({
  url: `https://placehold.co/1600x1067/1C1F23/F7F7F5/png?text=${encodeURIComponent(`${title}${i ? ` (${i + 1})` : ""}`)}`,
  publicId: `demo/${slugify(title)}-${i}`,
  width: 1600,
  height: 1067,
});

function description(spec: Spec, town: string): string {
  const [make, model, year, , mileage] = spec;
  return [
    `${year} ${make} ${model} in excellent condition, ${mileage.toLocaleString("en-KE")} km.`,
    "Accident free, full service history, new tyres and battery.",
    `Logbook ready. Viewing in ${town} by appointment. Financing can be arranged through our partner banks.`,
  ].join(" ");
}

async function upsertUser(name: string, email: string, role: "ADMIN" | "BUYER" | "BROKER" | "DEALER", phone: string, passwordHash: string) {
  await User.updateOne({ email }, { $setOnInsert: { name, email, role, phone, passwordHash, status: "ACTIVE", emailVerifiedAt: new Date() } }, { upsert: true });
  return (await User.findOne({ email }))!;
}

await connectDatabase();
await ensureDefaultPlans();
await ensureDefaultCategories();
await getSettings();
const passwordHash = await hashPassword(DEMO_PASSWORD);

await upsertUser("Showrooms Admin", "admin@showrooms.test", "ADMIN", "+254700000001", passwordHash);
const buyer = await upsertUser("Wanjiku Kamau", "buyer@showrooms.test", "BUYER", "+254711000002", passwordHash);

let created = 0;
for (const [sIndex, seller] of SELLERS.entries()) {
  const user = await upsertUser(seller.name, seller.email, seller.kind, seller.phone, passwordHash);
  let dealerId: Types.ObjectId | undefined;
  if (seller.kind === "BROKER") {
    const profile = (await BrokerProfile.findOne({ userId: user._id })) ?? (await createBrokerProfile(user._id, seller.name, seller.phone));
    profile.set({ town: seller.town, bio: seller.bio, yearsInBusiness: 3 + sIndex, verificationStatus: seller.verified ? "VERIFIED" : "UNVERIFIED", verifiedAt: seller.verified ? new Date() : undefined });
    await profile.save();
  } else {
    const profile = (await DealerProfile.findOne({ ownerId: user._id })) ?? (await createDealerProfile(user._id, seller.name, seller.phone));
    profile.set({ town: seller.town, description: seller.bio, address: `${AREAS[seller.town]?.[0] ?? "Town centre"}, ${seller.town}`, openingHours: "Mon–Sat 8:00–18:00", verificationStatus: "VERIFIED", verifiedAt: new Date() });
    await profile.save();
    dealerId = profile._id;
  }

  if (await Vehicle.exists({ sellerId: user._id })) continue;
  const mine = SPECS.filter((_, i) => i % SELLERS.length === sIndex);
  for (const [vIndex, spec] of mine.entries()) {
    const [make, model, year, price, mileage, bodyType, fuelType, engineCapacity, driveType, color, condition] = spec;
    const title = vehicleTitle({ year, make, model });
    const sid = shortId();
    const daysAgo = (sIndex * 3 + vIndex * 4) % 28;
    const publishedAt = new Date(Date.now() - daysAgo * 86_400_000 - vIndex * 3600_000);
    const area = AREAS[seller.town]?.[vIndex % (AREAS[seller.town]?.length ?? 1)];
    const featured = vIndex === 0 && sIndex < 4;
    const status = vIndex === mine.length - 1 && sIndex % 3 === 0 ? "SOLD" : "ACTIVE";
    const v = await Vehicle.create({
      sellerId: user._id,
      dealerId,
      shortId: sid,
      slug: `${slugify(title)}-${sid}`,
      title,
      make,
      model,
      makeKey: slugify(make),
      modelKey: slugify(model),
      year,
      price,
      priceNegotiable: vIndex % 2 === 0,
      mileage,
      fuelType,
      transmission: make === "Isuzu" || model === "Probox" || model === "Hiace" ? "MANUAL" : "AUTOMATIC",
      engineCapacity,
      bodyType,
      driveType,
      color,
      condition,
      importStatus: condition === "FOREIGN_USED" && vIndex % 4 === 3 ? "IN_TRANSIT" : "IN_KENYA",
      location: { town: seller.town, county: countyOf(seller.town), area },
      description: description(spec, seller.town),
      features: ["Air conditioning", "Reverse camera", "Bluetooth", "Alloy wheels", "Push start", "Navigation"].slice(0, 3 + (vIndex % 4)),
      images: [0, 1, 2].map((i) => placeholder(title, i)),
      status,
      soldAt: status === "SOLD" ? new Date(Date.now() - 2 * 86_400_000) : undefined,
      isVerified: seller.verified && vIndex % 3 === 0,
      isFeatured: featured,
      featuredUntil: featured ? new Date(Date.now() + 14 * 86_400_000) : undefined,
      promotionRank: featured ? 2 : 0,
      publishedAt,
      duplicateFingerprint: fingerprint({ makeKey: slugify(make), modelKey: slugify(model), year, mileage, color }),
      moderationHistory: [{ action: "APPROVE", at: publishedAt }],
      createdAt: publishedAt,
    });

    // A little traffic so analytics and "popular" sorting have something to show.
    const views = 5 + ((sIndex * 7 + vIndex * 13) % 40);
    for (let i = 0; i < views; i++) {
      const at = new Date(publishedAt.getTime() + i * ((Date.now() - publishedAt.getTime()) / views));
      await VehicleView.create({ vehicleId: v._id, sellerId: user._id, dealerId, viewerKey: `seed-${i}`, day: eatDay(at), source: i % 3 ? "mobile" : "web", createdAt: at });
      if (i % 6 === 0) await ContactClick.create({ vehicleId: v._id, sellerId: user._id, dealerId, viewerKey: `seed-${i}`, channel: i % 12 ? "WHATSAPP" : "CALL", day: eatDay(at), createdAt: at });
    }
    const clicks = await ContactClick.aggregate([{ $match: { vehicleId: v._id } }, { $group: { _id: "$channel", n: { $sum: 1 } } }]);
    const wa = clicks.find((c) => c._id === "WHATSAPP")?.n ?? 0;
    const call = clicks.find((c) => c._id === "CALL")?.n ?? 0;
    v.set({ viewCount: views, whatsappClicks: wa, callClicks: call, popularity: views + 5 * (wa + call) });
    await v.save();

    if (vIndex === 0) {
      await VehicleInquiry.create({ vehicleId: v._id, sellerId: user._id, dealerId, buyerId: buyer._id, type: "VIEWING_REQUEST", message: "Is it still available? I can come on Saturday morning.", phone: buyer.phone, preferredDate: new Date(Date.now() + 3 * 86_400_000) });
      await Vehicle.updateOne({ _id: v._id }, { $inc: { inquiryCount: 1 } });
    }
    created++;
  }
  const any = await Vehicle.findOne({ sellerId: user._id });
  if (any) await refreshListingCount(any);
}

logger.info(`Seed complete: ${SELLERS.length + 2} accounts, ${created} new vehicles. Password for every demo account: ${DEMO_PASSWORD}`);
await disconnectDatabase();
