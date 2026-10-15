import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone, registerSchema, whatsappLink } from "../index";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0712345678", "+254712345678"],
    ["0712 345 678", "+254712345678"],
    ["712345678", "+254712345678"],
    ["254712345678", "+254712345678"],
    ["+254 712-345-678", "+254712345678"],
    ["0110345678", "+254110345678"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["0212345678", "07123456", "+255712345678", "abc", ""])("rejects %s", (input) => {
    expect(normalizeKenyanPhone(input)).toBeNull();
  });
});

describe("registerSchema", () => {
  const base = { name: "Wanjiku Kamau", email: "Wanjiku@Example.com ", password: "safari2026" };

  it("normalises email and phone, defaults role to BUYER", () => {
    const parsed = registerSchema.parse({ ...base, phone: "0722 000 111" });
    expect(parsed).toMatchObject({ email: "wanjiku@example.com", phone: "+254722000111", role: "BUYER" });
  });

  it("refuses the ADMIN role", () => {
    expect(registerSchema.safeParse({ ...base, role: "ADMIN" }).success).toBe(false);
  });

  it("requires a letter and a number in the password", () => {
    expect(registerSchema.safeParse({ ...base, password: "onlyletters" }).success).toBe(false);
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link with an encoded message", () => {
    expect(whatsappLink("+254712345678", "Hi & hello")).toBe("https://wa.me/254712345678?text=Hi%20%26%20hello");
  });
});
