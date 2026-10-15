import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/modules/audit/audit-log.model";
import { createUserAndLogin, testApp, useTestDatabase } from "./helpers";

useTestDatabase();

describe("admin endpoints", () => {
  it("reject anonymous requests", async () => {
    expect((await testApp().get("/api/v1/admin/users")).status).toBe(401);
  });

  it.each(["BUYER", "BROKER", "DEALER"] as const)("reject %s accounts", async (role) => {
    const { accessToken } = await createUserAndLogin(role);
    const res = await testApp().get("/api/v1/admin/users").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("let admins list and filter users with pagination", async () => {
    const { accessToken } = await createUserAndLogin("ADMIN");
    await createUserAndLogin("BROKER");
    await createUserAndLogin("BROKER");
    const res = await testApp().get("/api/v1/admin/users?role=BROKER&limit=1").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 });
  });

  it("let admins suspend a user, which ends their sessions and is audited", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const res = await testApp()
      .patch(`/api/v1/admin/users/${broker.user._id}/status`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "SUSPENDED", reason: "Fake listings" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("SUSPENDED");

    expect((await testApp().post("/api/v1/auth/refresh").send({ refreshToken: broker.refreshToken })).status).toBe(401);
    expect((await testApp().get("/api/v1/auth/me").set("Authorization", `Bearer ${broker.accessToken}`)).status).toBe(403);
    const log = await AuditLog.findOne({ action: "admin.user_status_changed" }).lean();
    expect(log).toMatchObject({ entityType: "User", metadata: { from: "ACTIVE", to: "SUSPENDED", reason: "Fake listings" } });
  });

  it("do not let an admin suspend another admin", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const other = await createUserAndLogin("ADMIN");
    const res = await testApp()
      .patch(`/api/v1/admin/users/${other.user._id}/status`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ status: "SUSPENDED" });
    expect(res.status).toBe(403);
  });

  it("validate ids", async () => {
    const { accessToken } = await createUserAndLogin("ADMIN");
    const res = await testApp().patch("/api/v1/admin/users/not-an-id/status").set("Authorization", `Bearer ${accessToken}`).send({ status: "ACTIVE" });
    expect(res.status).toBe(422);
  });
});

describe("profile", () => {
  it("lets a user update their own name and phone, never their role", async () => {
    const { accessToken } = await createUserAndLogin("BUYER");
    const res = await testApp()
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Achieng Odhiambo", phone: "0799 111 222", role: "ADMIN" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: "Achieng Odhiambo", phone: "+254799111222", role: "BUYER" });
  });
});

describe("platform", () => {
  it("reports health", async () => {
    const res = await testApp().get("/api/v1/health");
    expect(res.body.data).toEqual({ status: "ok", db: "up" });
  });

  it("returns a consistent 404 with a request id", async () => {
    const res = await testApp().get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND" });
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });

  it("only allows CORS from allowlisted origins", async () => {
    const good = await testApp().options("/api/v1/auth/login").set("Origin", "http://localhost:3000").set("Access-Control-Request-Method", "POST");
    const bad = await testApp().options("/api/v1/auth/login").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "POST");
    expect(good.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("serves the OpenAPI spec", async () => {
    const res = await testApp().get("/api/docs.json");
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(["/auth/login", "/admin/users"]));
  });
});
