import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import type { UserRole } from "@showrooms/shared";
import { createApp, type AppOptions } from "../src/app";
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
