import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("safeNext", () => {
  it("only allows same-site relative paths", async () => {
    const { safeNext } = await import("@/features/auth/safe-next");
    expect(safeNext("/dashboard/saved")).toBe("/dashboard/saved");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext(null, "/vehicles")).toBe("/vehicles");
  });
});

describe("poster signature", () => {
  it("accepts the API's signature and rejects tampering or expiry", async () => {
    process.env.POSTER_SIGNING_SECRET = "s".repeat(40);
    const { verifyPosterSignature } = await import("@/lib/og/poster-signature");
    const id = "a".repeat(24);
    const exp = String(Math.floor(Date.now() / 1000) + 600);
    const sig = createHmac("sha256", "s".repeat(40)).update(`${id}.${exp}`).digest("base64url");
    expect(verifyPosterSignature(id, exp, sig)).toBe(true);
    expect(verifyPosterSignature("b".repeat(24), exp, sig)).toBe(false);
    expect(verifyPosterSignature(id, String(Number(exp) + 1), sig)).toBe(false);
    expect(verifyPosterSignature(id, exp, sig, (Number(exp) + 1) * 1000)).toBe(false);
  });
});

describe("ApiError", () => {
  it("maps validation details to field errors", async () => {
    const { ApiError } = await import("@/lib/api-error");
    const err = new ApiError(422, "VALIDATION_ERROR", "bad", [{ path: "price", message: "Too low" }]);
    expect(err.fieldErrors()).toEqual({ price: "Too low" });
  });
});
