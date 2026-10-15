import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import type { UserRole } from "@showrooms/shared";
import { createApp, type AppOptions } from "../src/app";
import { clearCategoryCountsCache } from "../src/modules/categories/categories.routes";
import { clearSettingsCache } from "../src/modules/settings/settings.service";
import { setServices } from "../src/services";
import { MemoryEmailService } from "../src/services/email/console.email";
import { FakeMediaService } from "../src/services/media/fake.media";
import { FakeMpesaService } from "../src/services/payments/fake.mpesa";
import { MemoryPushService } from "../src/services/push/push.service";
import { hashPassword } from "../src/modules/auth/password";
import { User } from "../src/modules/users/user.model";

/** Each test file gets its own database on the shared replica set, wiped before every test. */
export function useTestDatabase() {
  beforeAll(async () => {
    const uri = new URL(inject("mongoUri"));
    uri.pathname = `/test_${randomUUID().slice(0, 8)}`;
    await mongoose.connect(uri.toString());
    await mongoose.connection.syncIndexes();
  });
  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    clearSettingsCache();
    clearCategoryCountsCache();
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}

export function testApp(options: AppOptions = { rateLimit: false }) {
  return request(createApp(options));
}

export const PASSWORD = "Safari2026";

/** Inserts a user directly (the only way to create an ADMIN) and signs them in. */
export async function createUserAndLogin(role: UserRole, overrides: { email?: string; status?: "ACTIVE" | "SUSPENDED" } = {}) {
  const email = overrides.email ?? `${role.toLowerCase()}-${randomUUID().slice(0, 6)}@example.com`;
  const user = await User.create({
    name: `${role} user`,
    email,
    role,
    status: overrides.status ?? "ACTIVE",
    passwordHash: await hashPassword(PASSWORD),
  });
  const res = await testApp().post("/api/v1/auth/login").set("X-Client-Type", "mobile").send({ email, password: PASSWORD });
  return { user, accessToken: res.body.data?.accessToken as string, refreshToken: res.body.data?.refreshToken as string };
}

/** Fresh test doubles for every external integration. */
export function useFakeServices() {
  const fakes = {
    email: new MemoryEmailService(),
    media: new FakeMediaService(),
    mpesa: new FakeMpesaService(),
    push: new MemoryPushService(),
  };
  beforeEach(() => {
    fakes.email = new MemoryEmailService();
    fakes.media = new FakeMediaService();
    fakes.mpesa = new FakeMpesaService();
    fakes.push = new MemoryPushService();
    setServices(fakes);
  });
  return fakes;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const VEHICLE = {
  make: "Toyota",
  model: "Fielder",
  year: 2017,
  price: 1_450_000,
  priceNegotiable: true,
  mileage: 86_000,
  fuelType: "PETROL",
  transmission: "AUTOMATIC",
  engineCapacity: 1500,
  bodyType: "STATION_WAGON",
  driveType: "FWD",
  color: "Silver",
  condition: "FOREIGN_USED",
  importStatus: "IN_KENYA",
  location: { town: "Nakuru", area: "Milimani" },
  description: "Clean Toyota Fielder, accident free, full service history, new tyres. Viewing in Nakuru town.",
  features: ["Reverse camera", "Push start"],
} as const;

/** Draft + one uploaded photo, ready to submit. */
export async function createListing(token: string, media: FakeMediaService, overrides: Record<string, unknown> = {}): Promise<string> {
  const draft = await testApp().post("/api/v1/vehicles").set(auth(token)).send({ ...VEHICLE, ...overrides });
  if (draft.status !== 201) throw new Error(`Draft failed: ${JSON.stringify(draft.body)}`);
  const id = draft.body.data.id as string;
  await uploadPhoto(token, media, id);
  return id;
}

export async function uploadPhoto(token: string, media: FakeMediaService, vehicleId: string) {
  const sig = await testApp().post("/api/v1/uploads/signature").set(auth(token)).send({ purpose: "VEHICLE_IMAGE", vehicleId, contentType: "image/jpeg", fileSize: 300_000 });
  if (sig.status !== 200) throw new Error(`Signature failed: ${JSON.stringify(sig.body)}`);
  media.upload(sig.body.data.publicId);
  const done = await testApp().post("/api/v1/uploads/complete").set(auth(token)).send({ purpose: "VEHICLE_IMAGE", vehicleId, publicId: sig.body.data.publicId });
  if (done.status !== 200) throw new Error(`Complete failed: ${JSON.stringify(done.body)}`);
  return sig.body.data.publicId as string;
}

/** Submits and, when review is required, approves as an admin. */
export async function publishListing(sellerToken: string, adminToken: string, id: string) {
  const sub = await testApp().post(`/api/v1/vehicles/${id}/submit`).set(auth(sellerToken));
  if (sub.status !== 200) throw new Error(`Submit failed: ${JSON.stringify(sub.body)}`);
  if (sub.body.data.status === "PENDING_REVIEW") {
    const appr = await testApp().post(`/api/v1/admin/vehicles/${id}/moderate`).set(auth(adminToken)).send({ action: "APPROVE" });
    if (appr.status !== 200) throw new Error(`Approve failed: ${JSON.stringify(appr.body)}`);
  }
}

export function stkCallback(checkoutRequestId: string, merchantRequestId: string, opts: { resultCode?: number; amount?: number; receipt?: string } = {}) {
  const resultCode = opts.resultCode ?? 0;
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: merchantRequestId,
        CheckoutRequestID: checkoutRequestId,
        ResultCode: resultCode,
        ResultDesc: resultCode === 0 ? "The service request is processed successfully." : "Request cancelled by user",
        ...(resultCode === 0
          ? {
              CallbackMetadata: {
                Item: [
                  { Name: "Amount", Value: opts.amount ?? 0 },
                  { Name: "MpesaReceiptNumber", Value: opts.receipt ?? `RKT${Math.random().toString(36).slice(2, 9).toUpperCase()}` },
                  { Name: "TransactionDate", Value: 20261015101010 },
                  { Name: "PhoneNumber", Value: 254712345678 },
                ],
              },
            }
          : {}),
      },
    },
  };
}

export const CALLBACK_PATH = `/api/v1/payments/mpesa/callback?token=${process.env.MPESA_CALLBACK_TOKEN}`;
