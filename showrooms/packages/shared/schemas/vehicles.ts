import { z } from "zod";
import { TOWN_NAMES } from "../constants/kenya";
import {
  BODY_TYPES,
  CONDITIONS,
  DRIVE_TYPES,
  FUEL_TYPES,
  IMPORT_STATUSES,
  TRANSMISSIONS,
  VEHICLE_LIMITS,
  VEHICLE_SORTS,
  VEHICLE_STATUSES,
} from "../constants/vehicles";
import { objectIdSchema } from "./common";

const currentYear = () => new Date().getFullYear();
const boolParam = z.enum(["true", "false"]).transform((v) => v === "true");

export const vehicleLocationSchema = z.object({
  town: z.enum(TOWN_NAMES),
  area: z.string().trim().max(80).optional(),
});

/**
 * Every field a seller can set. Drafts may be incomplete, so all fields are
 * optional here; `assertPublishable` checks completeness at submit time.
 * Ownership, status, slugs, counters and media are never accepted from clients.
 */
export const vehicleFieldsSchema = z.object({
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(60),
  year: z.coerce.number().int().min(VEHICLE_LIMITS.minYear).refine((y) => y <= currentYear() + 1, "Year is in the future"),
  price: z.coerce.number().int("Enter a whole number of shillings").min(10_000, "Price looks too low").max(VEHICLE_LIMITS.maxPriceKes),
  priceNegotiable: z.boolean(),
  mileage: z.coerce.number().int().min(0).max(VEHICLE_LIMITS.maxMileageKm),
  fuelType: z.enum(FUEL_TYPES),
  transmission: z.enum(TRANSMISSIONS),
  engineCapacity: z.coerce.number().int().min(50, "Engine capacity is in cc, e.g. 1500").max(10_000),
  bodyType: z.enum(BODY_TYPES),
  driveType: z.enum(DRIVE_TYPES),
  color: z.string().trim().min(2).max(30),
  condition: z.enum(CONDITIONS),
  importStatus: z.enum(IMPORT_STATUSES),
  location: vehicleLocationSchema,
  description: z.string().trim().max(4000),
  features: z.array(z.string().trim().min(1).max(40)).max(40),
});

export const vehicleDraftSchema = vehicleFieldsSchema.partial();
export type VehicleDraftInput = z.input<typeof vehicleDraftSchema>;

export const updateVehicleSchema = vehicleDraftSchema.extend({
  /** Full list of image publicIds to keep, in display order. The first is the primary image. */
  imageOrder: z.array(z.string().min(1).max(200)).max(VEHICLE_LIMITS.maxImages).optional(),
  /** Full list of video publicIds to keep. */
  videoOrder: z.array(z.string().min(1).max(200)).max(VEHICLE_LIMITS.maxVideos).optional(),
});
export type UpdateVehicleInput = z.input<typeof updateVehicleSchema>;

/** What a listing needs before it can be submitted for review. */
export const publishableVehicleSchema = vehicleFieldsSchema.extend({
  description: z.string().trim().min(30, "Write at least 30 characters so buyers know what they're getting").max(4000),
  features: vehicleFieldsSchema.shape.features.default([]),
  priceNegotiable: z.boolean().default(false),
});

export const vehicleSearchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  make: z.string().trim().max(40).optional(),
  model: z.string().trim().max(60).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minYear: z.coerce.number().int().min(VEHICLE_LIMITS.minYear).optional(),
  maxYear: z.coerce.number().int().optional(),
  maxMileage: z.coerce.number().int().min(0).optional(),
  town: z.enum(TOWN_NAMES).optional(),
  fuelType: z.enum(FUEL_TYPES).optional(),
  transmission: z.enum(TRANSMISSIONS).optional(),
  bodyType: z.enum(BODY_TYPES).optional(),
  driveType: z.enum(DRIVE_TYPES).optional(),
  condition: z.enum(CONDITIONS).optional(),
  importStatus: z.enum(IMPORT_STATUSES).optional(),
  sellerId: objectIdSchema.optional(),
  dealerId: objectIdSchema.optional(),
  featured: boolParam.optional(),
  sort: z.enum(VEHICLE_SORTS).default("recommended"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
export type VehicleSearchQuery = z.input<typeof vehicleSearchSchema>;
export type VehicleSearchParams = z.output<typeof vehicleSearchSchema>;

/**
 * Same filters for web URLs and mobile state; this turns them into the API query
 * string. Built by hand because URLSearchParams is incomplete in React Native.
 */
export function toQueryString(filters: object): string {
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

export const myVehiclesQuerySchema = z.object({
  status: z.enum(VEHICLE_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const contactClickSchema = z.object({
  channel: z.enum(["WHATSAPP", "CALL"]),
});

export const markSoldSchema = z.object({
  soldPrice: z.coerce.number().int().min(0).optional(),
});
