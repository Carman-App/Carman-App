import { describe, expect, it, beforeEach } from "vitest";
import { setServices } from "../src/services";
import { MemoryEmailService } from "../src/services/email/console.email";
import { AuditLog } from "../src/modules/audit/audit-log.model";
import { RefreshToken } from "../src/modules/auth/refresh-token.model";
import { User } from "../src/modules/users/user.model";
import { PASSWORD, createUserAndLogin, testApp, useTestDatabase } from "./helpers";

useTestDatabase();

const register = (body: Record<string, unknown>, mobile = false) => {
  const req = testApp().post("/api/v1/auth/register");
  if (mobile) req.set("X-Client-Type", "mobile");
  return req.send(body);
};

const buyer = { name: "Wanjiku Kamau", email: "wanjiku@example.com", password: PASSWORD, phone: "0712 345 678" };

describe("POST /auth/register", () => {
  it("creates a buyer, normalises the phone, never returns the password hash", async () => {
    const res = await register(buyer);
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: "wanjiku@example.com", phone: "+254712345678", role: "BUYER", status: "ACTIVE" });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeTypeOf("string");
  });

  it("gives browsers an HttpOnly cookie and no refresh token in the body", async () => {
    const res = await register(buyer);
    expect(res.body.data.refreshToken).toBeUndefined();
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/^sr_refresh=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("gives mobile clients the refresh token in the body and no cookie", async () => {
    const res = await register(buyer, true);
    expect(res.body.data.refreshToken).toBeTypeOf("string");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("lets people register as brokers and dealers", async () => {
    expect((await register({ ...buyer, role: "BROKER" })).body.data.user.role).toBe("BROKER");
    expect((await register({ ...buyer, email: "d@example.com", phone: undefined, role: "DEALER" })).body.data.user.role).toBe("DEALER");
  });

  it("never lets anyone register as ADMIN", async () => {
    const res = await register({ ...buyer, role: "ADMIN" });
    expect(res.status).toBe(422);
    expect(await User.countDocuments({ role: "ADMIN" })).toBe(0);
  });

  it("ignores unknown fields like status", async () => {
    const res = await register({ ...buyer, status: "SUSPENDED", passwordHash: "x" });
    expect(res.body.data.user.status).toBe("ACTIVE");
  });

  it("rejects duplicate emails and phones", async () => {
    await register(buyer);
    expect((await register({ ...buyer, phone: undefined })).body.error.code).toBe("EMAIL_TAKEN");
    const res = await register({ ...buyer, email: "other@example.com", phone: "+254712345678" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PHONE_TAKEN");
  });

  it("validates input with field-level errors", async () => {
    const res = await register({ name: "A", email: "nope", password: "short", phone: "12345" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["name", "email", "password", "phone"]));
  });
});

describe("POST /auth/login", () => {
  beforeEach(async () => {
    await register(buyer);
  });

  it("signs in with the right password (email is case-insensitive)", async () => {
    const res = await testApp().post("/api/v1/auth/login").send({ email: "WANJIKU@example.com", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe("wanjiku@example.com");
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const wrong = await testApp().post("/api/v1/auth/login").send({ email: buyer.email, password: "Wrong12345" });
    const unknown = await testApp().post("/api/v1/auth/login").send({ email: "ghost@example.com", password: "Wrong12345" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toMatchObject({ code: "INVALID_CREDENTIALS", message: unknown.body.error.message });
    expect(await AuditLog.countDocuments({ action: "auth.login_failed" })).toBe(1);
  });

  it("refuses suspended accounts", async () => {
    await User.updateOne({ email: buyer.email }, { status: "SUSPENDED" });
    const res = await testApp().post("/api/v1/auth/login").send({ email: buyer.email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("GET /auth/me", () => {
  it("returns the signed-in user", async () => {
    const { accessToken, user } = await createUserAndLogin("BROKER");
    const res = await testApp().get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(String(user._id));
  });

  it("rejects missing, malformed and tampered tokens", async () => {
    const { accessToken } = await createUserAndLogin("BUYER");
    expect((await testApp().get("/api/v1/auth/me")).status).toBe(401);
    expect((await testApp().get("/api/v1/auth/me").set("Authorization", "Bearer nonsense")).status).toBe(401);
    const [h, p, s] = accessToken.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, "base64url").toString()), role: "ADMIN" })).toString("base64url");
    expect((await testApp().get("/api/v1/auth/me").set("Authorization", `Bearer ${h}.${forged}.${s}`)).status).toBe(401);
  });

  it("locks out a user as soon as they are suspended, even with a live token", async () => {
    const { accessToken, user } = await createUserAndLogin("BROKER");
    await User.updateOne({ _id: user._id }, { status: "SUSPENDED" });
    const res = await testApp().get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });
});

describe("refresh token rotation", () => {
  it("rotates: the new token works, the old one does not", async () => {
    const { refreshToken } = await createUserAndLogin("BUYER");
    const first = await testApp().post("/api/v1/auth/refresh").set("X-Client-Type", "mobile").send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(refreshToken);
    expect(first.body.data.accessToken).toBeTypeOf("string");

    const second = await testApp().post("/api/v1/auth/refresh").send({ refreshToken: first.body.data.refreshToken });
    expect(second.status).toBe(200);
  });

  it("revokes the whole family when a rotated token is reused", async () => {
    const { refreshToken } = await createUserAndLogin("BUYER");
    const rotated = await testApp().post("/api/v1/auth/refresh").send({ refreshToken });
    const stolen = await testApp().post("/api/v1/auth/refresh").send({ refreshToken });
    expect(stolen.status).toBe(401);

    // The legitimate holder's newer token is now dead as well.
    const legit = await testApp().post("/api/v1/auth/refresh").send({ refreshToken: rotated.body.data.refreshToken });
    expect(legit.status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedReason: "REUSE_DETECTED" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "auth.refresh_reuse_detected" })).toBe(1);
  });

  it("refreshes a browser session from the cookie, but only with X-Requested-With", async () => {
    const reg = await register(buyer);
    const cookie = reg.headers["set-cookie"]![0]!.split(";")[0]!;

    const blocked = await testApp().post("/api/v1/auth/refresh").set("Cookie", cookie).send({});
    expect(blocked.status).toBe(403);

    const res = await testApp().post("/api/v1/auth/refresh").set("Cookie", cookie).set("X-Requested-With", "showrooms").send({});
    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/^sr_refresh=/);
  });

  it("logout revokes the session", async () => {
    const { refreshToken } = await createUserAndLogin("BUYER");
    expect((await testApp().post("/api/v1/auth/logout").send({ refreshToken })).status).toBe(204);
    expect((await testApp().post("/api/v1/auth/refresh").send({ refreshToken })).status).toBe(401);
  });

  it("refuses to refresh for a suspended user", async () => {
    const { refreshToken, user } = await createUserAndLogin("BROKER");
    await User.updateOne({ _id: user._id }, { status: "SUSPENDED" });
    expect((await testApp().post("/api/v1/auth/refresh").send({ refreshToken })).status).toBe(403);
  });
});

describe("password reset", () => {
  it("emails a link, resets the password, and signs out every device", async () => {
    const mail = new MemoryEmailService();
    setServices({ email: mail });
    const { refreshToken, accessToken } = await createUserAndLogin("BROKER", { email: "otieno@example.com" });

    const forgot = await testApp().post("/api/v1/auth/forgot-password").send({ email: "otieno@example.com" });
    expect(forgot.status).toBe(202);
    expect(mail.sent).toHaveLength(1);
    const token = new URL(/https?:\/\/\S+/.exec(mail.sent[0]!.text)![0]).searchParams.get("token")!;

    // Let the second tick over so the old access token's iat is clearly before the change.
    await new Promise((r) => setTimeout(r, 1100));
    const reset = await testApp().post("/api/v1/auth/reset-password").send({ token, password: "NewPassword9" });
    expect(reset.status).toBe(200);

    expect((await testApp().post("/api/v1/auth/reset-password").send({ token, password: "Another123" })).status).toBe(400);
    expect((await testApp().post("/api/v1/auth/refresh").send({ refreshToken })).status).toBe(401);
    expect((await testApp().get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`)).status).toBe(401);
    expect((await testApp().post("/api/v1/auth/login").send({ email: "otieno@example.com", password: "NewPassword9" })).status).toBe(200);
  });

  it("answers the same way for unknown emails and sends nothing", async () => {
    const mail = new MemoryEmailService();
    setServices({ email: mail });
    const res = await testApp().post("/api/v1/auth/forgot-password").send({ email: "nobody@example.com" });
    expect(res.status).toBe(202);
    expect(mail.sent).toHaveLength(0);
  });
});

describe("rate limiting", () => {
  it("throttles repeated login attempts for the same email", async () => {
    const app = testApp({ rateLimit: true });
    const attempts = [];
    for (let i = 0; i < 11; i++) {
      attempts.push(await app.post("/api/v1/auth/login").send({ email: "target@example.com", password: "Guess12345" }));
    }
    expect(attempts.slice(0, 10).every((r) => r.status === 401)).toBe(true);
    expect(attempts[10]!.status).toBe(429);
    expect(attempts[10]!.body.error.code).toBe("RATE_LIMITED");
  });
});
