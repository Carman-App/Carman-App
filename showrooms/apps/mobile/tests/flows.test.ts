import { Linking } from "react-native";
import { vehicleSearchSchema, type Vehicle } from "@showrooms/shared";
import { EMPTY_FORM, toPayload } from "@/features/listing/form";
import { sellerShareMessage, shareToWhatsApp } from "@/services/share";
import { activeFilterCount, filtersToQuery } from "@/stores/filters";

const vehicle = {
  id: "v1", slug: "2017-toyota-fielder-abc123", title: "2017 Toyota Fielder", make: "Toyota", model: "Fielder", year: 2017, price: 1450000, priceNegotiable: true,
  mileage: 86000, transmission: "AUTOMATIC", fuelType: "PETROL", engineCapacity: 1500, condition: "FOREIGN_USED", location: { town: "Nakuru" }, images: [], videos: [],
} as unknown as Vehicle;

describe("search filters", () => {
  it("produce the same query string keys the web app and API use", () => {
    const qs = filtersToQuery({ make: "Toyota", maxPrice: 2000000, town: "Nakuru", sort: "price_asc" }, 2);
    expect(qs).toBe("make=Toyota&maxPrice=2000000&town=Nakuru&sort=price_asc&page=2&limit=20");
    const parsed = vehicleSearchSchema.parse(Object.fromEntries(qs.split("&").map((p) => p.split("=").map(decodeURIComponent))));
    expect(parsed).toMatchObject({ make: "Toyota", maxPrice: 2000000, town: "Nakuru", sort: "price_asc", page: 2 });
  });
  it("count active filters, ignoring sort and free text", () => {
    expect(activeFilterCount({ sort: "newest", q: "fielder", make: "Toyota", bodyType: "SUV" })).toBe(2);
  });
});

describe("WhatsApp sharing", () => {
  it("builds the seller message with price, location, specs, link and name", () => {
    const msg = sellerShareMessage(vehicle, "Otieno Motors");
    expect(msg).toContain("2017 Toyota Fielder");
    expect(msg).toContain("KES 1,450,000 (negotiable)");
    expect(msg).toContain("Nakuru");
    expect(msg).toContain("/vehicles/2017-toyota-fielder-abc123");
    expect(msg).toContain("Otieno Motors");
  });

  it("opens WhatsApp with a prefilled message (never sends it)", async () => {
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await shareToWhatsApp("hello & welcome");
    expect(open).toHaveBeenCalledWith("whatsapp://send?text=hello%20%26%20welcome");
  });

  it("falls back to wa.me when WhatsApp isn't installed", async () => {
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(false);
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await shareToWhatsApp("hi");
    expect(open).toHaveBeenCalledWith("https://wa.me/?text=hi");
  });
});

describe("listing wizard validation", () => {
  it("validates a step with the API's own rules before saving", () => {
    const bad = toPayload({ ...EMPTY_FORM, year: "1950", mileage: "86000", engineCapacity: "15" }, ["year", "mileage", "engineCapacity"]);
    expect(Object.keys(bad.errors).sort()).toEqual(["engineCapacity", "year"]);
    const good = toPayload({ ...EMPTY_FORM, price: "1,450,000", town: "Nakuru", area: "Milimani", priceNegotiable: true }, ["price", "priceNegotiable", "town", "area"]);
    expect(good.errors).toEqual({});
    expect(good.payload).toEqual({ price: 1450000, priceNegotiable: true, location: { town: "Nakuru", area: "Milimani" } });
  });
});
