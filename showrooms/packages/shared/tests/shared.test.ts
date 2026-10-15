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

import { buildWhatsAppShareMessage, formatKes, formatKesCompact, imageUrl, publishableVehicleSchema, uploadSignatureSchema, vehicleSearchSchema } from "../index";

describe("formatting", () => {
  it("formats shillings", () => {
    expect(formatKes(1250000)).toBe("KES 1,250,000");
    expect(formatKesCompact(1250000)).toBe("KES 1.25M");
    expect(formatKesCompact(850000)).toBe("KES 850K");
  });
});

describe("buildWhatsAppShareMessage", () => {
  it("includes title, price, location, specs, link and seller", () => {
    const msg = buildWhatsAppShareMessage(
      { year: 2017, make: "Toyota", model: "Fielder", price: 1450000, priceNegotiable: true, mileage: 86000, transmission: "AUTOMATIC", fuelType: "PETROL", engineCapacity: 1500, location: { town: "Nakuru" } },
      "https://showrooms.co.ke/vehicles/2017-toyota-fielder-abc",
      "Otieno Motors",
    );
    expect(msg).toContain("2017 Toyota Fielder");
    expect(msg).toContain("KES 1,450,000 (negotiable)");
    expect(msg).toContain("📍 Nakuru");
    expect(msg).toContain("86,000 km · Automatic · Petrol · 1,500 cc");
    expect(msg).toContain("https://showrooms.co.ke/vehicles/2017-toyota-fielder-abc");
    expect(msg).toContain("— Otieno Motors");
  });
});

describe("imageUrl", () => {
  it("adds Cloudinary transformations", () => {
    expect(imageUrl("https://res.cloudinary.com/demo/image/upload/v1/showrooms/a.jpg", { width: 480 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_480,c_limit/v1/showrooms/a.jpg",
    );
  });
  it("leaves other URLs alone", () => {
    expect(imageUrl("https://picsum.photos/800", { width: 480 })).toBe("https://picsum.photos/800");
  });
});

describe("vehicle schemas", () => {
  it("parses search query strings with defaults", () => {
    const q = vehicleSearchSchema.parse({ make: "Toyota", maxPrice: "2000000", featured: "true" });
    expect(q).toMatchObject({ make: "Toyota", maxPrice: 2000000, featured: true, sort: "recommended", page: 1, limit: 24 });
  });

  it("requires a description before publishing", () => {
    const r = publishableVehicleSchema.safeParse({
      make: "Mazda", model: "CX-5", year: 2018, price: 2900000, mileage: 70000, fuelType: "PETROL", transmission: "AUTOMATIC",
      engineCapacity: 2000, bodyType: "SUV", driveType: "AWD", color: "Red", condition: "FOREIGN_USED", importStatus: "IN_KENYA",
      location: { town: "Nairobi" }, description: "short",
    });
    expect(r.success).toBe(false);
  });

  it("rejects disallowed upload types and sizes", () => {
    expect(uploadSignatureSchema.safeParse({ purpose: "VEHICLE_IMAGE", vehicleId: "a".repeat(24), contentType: "application/x-msdownload", fileSize: 10 }).success).toBe(false);
    expect(uploadSignatureSchema.safeParse({ purpose: "VEHICLE_IMAGE", vehicleId: "a".repeat(24), contentType: "image/jpeg", fileSize: 50 * 1024 * 1024 }).success).toBe(false);
    expect(uploadSignatureSchema.safeParse({ purpose: "VEHICLE_IMAGE", vehicleId: "a".repeat(24), contentType: "image/jpeg", fileSize: 500_000 }).success).toBe(true);
  });
});

import { toQueryString } from "../index";
describe("toQueryString", () => {
  it("drops empty values and encodes", () => {
    expect(toQueryString({ make: "Mercedes-Benz", q: "c 200", model: "", page: 2, x: undefined })).toBe("make=Mercedes-Benz&q=c%20200&page=2");
  });
});
