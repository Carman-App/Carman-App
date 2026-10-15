import { vehicleFieldsSchema, type Vehicle } from "@showrooms/shared";

/** Form state is strings (TextInput values); empty means "not set yet". */
export interface ListingForm {
  make: string;
  model: string;
  year: string;
  mileage: string;
  transmission: string;
  fuelType: string;
  engineCapacity: string;
  bodyType: string;
  driveType: string;
  color: string;
  condition: string;
  importStatus: string;
  price: string;
  priceNegotiable: boolean;
  town: string;
  area: string;
  description: string;
  features: string[];
}

export const EMPTY_FORM: ListingForm = {
  make: "", model: "", year: "", mileage: "", transmission: "", fuelType: "", engineCapacity: "", bodyType: "", driveType: "", color: "", condition: "", importStatus: "IN_KENYA",
  price: "", priceNegotiable: false, town: "", area: "", description: "", features: [],
};

export const STEP_FIELDS: Record<number, (keyof ListingForm)[]> = {
  2: ["make", "model", "year", "mileage", "transmission", "fuelType", "engineCapacity", "bodyType", "driveType", "color", "condition", "importStatus"],
  3: ["price", "priceNegotiable", "town", "area"],
  4: ["description", "features"],
};

const NUMERIC = new Set(["year", "mileage", "engineCapacity", "price"]);

export function fromVehicle(v: Vehicle): ListingForm {
  const s = (n?: number) => (n ? String(n) : "");
  return {
    make: v.make ?? "", model: v.model ?? "", year: s(v.year), mileage: v.mileage || v.status !== "DRAFT" ? String(v.mileage ?? "") : "",
    transmission: v.transmission ?? "", fuelType: v.fuelType ?? "", engineCapacity: s(v.engineCapacity), bodyType: v.bodyType ?? "", driveType: v.driveType ?? "",
    color: v.color ?? "", condition: v.condition ?? "", importStatus: v.importStatus ?? "IN_KENYA", price: s(v.price), priceNegotiable: !!v.priceNegotiable,
    town: v.location?.town ?? "", area: v.location?.area ?? "", description: v.description ?? "", features: v.features ?? [],
  };
}

/** Builds the PATCH body for some fields and validates it with the same schema the API uses. */
export function toPayload(form: ListingForm, fields: (keyof ListingForm)[]): { payload: Record<string, unknown>; errors: Record<string, string> } {
  const payload: Record<string, unknown> = {};
  for (const f of fields) {
    if (f === "town" || f === "area") continue;
    const v = form[f];
    if (v === "" || v === undefined) continue;
    payload[f] = NUMERIC.has(f) ? Number(String(v).replace(/\D/g, "")) : v;
  }
  if (fields.includes("town") && form.town) payload.location = { town: form.town, area: form.area || undefined };
  const check = vehicleFieldsSchema.partial().safeParse(payload);
  const errors: Record<string, string> = {};
  if (!check.success) for (const i of check.error.issues) errors[i.path[0] === "location" ? "town" : String(i.path[0])] = i.message;
  return { payload, errors };
}
