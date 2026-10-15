export const VEHICLE_STATUSES = ["DRAFT", "PENDING_REVIEW", "ACTIVE", "REJECTED", "SOLD", "SUSPENDED", "ARCHIVED"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const FUEL_TYPES = ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "PLUG_IN_HYBRID"] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const TRANSMISSIONS = ["AUTOMATIC", "MANUAL"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const BODY_TYPES = ["SEDAN", "HATCHBACK", "SUV", "STATION_WAGON", "PICKUP", "VAN", "MINIVAN", "COUPE", "CONVERTIBLE", "BUS", "TRUCK"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const DRIVE_TYPES = ["FWD", "RWD", "AWD", "FOUR_WD"] as const;
export type DriveType = (typeof DRIVE_TYPES)[number];

/** The terms Kenyan buyers use: "foreign used" means imported second-hand. */
export const CONDITIONS = ["NEW", "FOREIGN_USED", "LOCALLY_USED"] as const;
export type Condition = (typeof CONDITIONS)[number];

/** Where the car physically is: brokers often list cars still on the ship or to order from Japan/UK. */
export const IMPORT_STATUSES = ["IN_KENYA", "IN_TRANSIT", "DIRECT_IMPORT"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const VEHICLE_SORTS = ["recommended", "newest", "price_asc", "price_desc", "popular", "year_desc", "mileage_asc"] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export const LABELS = {
  status: {
    DRAFT: "Draft",
    PENDING_REVIEW: "Pending review",
    ACTIVE: "Active",
    REJECTED: "Needs changes",
    SOLD: "Sold",
    SUSPENDED: "Suspended",
    ARCHIVED: "Archived",
  } satisfies Record<VehicleStatus, string>,
  fuelType: { PETROL: "Petrol", DIESEL: "Diesel", HYBRID: "Hybrid", ELECTRIC: "Electric", PLUG_IN_HYBRID: "Plug-in hybrid" } satisfies Record<FuelType, string>,
  transmission: { AUTOMATIC: "Automatic", MANUAL: "Manual" } satisfies Record<Transmission, string>,
  bodyType: {
    SEDAN: "Sedan",
    HATCHBACK: "Hatchback",
    SUV: "SUV",
    STATION_WAGON: "Station wagon",
    PICKUP: "Pickup",
    VAN: "Van",
    MINIVAN: "Minivan",
    COUPE: "Coupe",
    CONVERTIBLE: "Convertible",
    BUS: "Bus",
    TRUCK: "Truck",
  } satisfies Record<BodyType, string>,
  driveType: { FWD: "2WD (front)", RWD: "2WD (rear)", AWD: "AWD", FOUR_WD: "4WD" } satisfies Record<DriveType, string>,
  condition: { NEW: "Brand new", FOREIGN_USED: "Foreign used", LOCALLY_USED: "Locally used" } satisfies Record<Condition, string>,
  importStatus: { IN_KENYA: "In Kenya", IN_TRANSIT: "In transit", DIRECT_IMPORT: "Direct import (to order)" } satisfies Record<ImportStatus, string>,
  sort: {
    recommended: "Recommended",
    newest: "Newest",
    price_asc: "Price: low to high",
    price_desc: "Price: high to low",
    popular: "Most popular",
    year_desc: "Year: newest",
    mileage_asc: "Mileage: lowest",
  } satisfies Record<VehicleSort, string>,
} as const;

export const COMMON_FEATURES = [
  "Air conditioning",
  "Reverse camera",
  "Parking sensors",
  "Push start",
  "Keyless entry",
  "Leather seats",
  "Sunroof",
  "Navigation",
  "Bluetooth",
  "Android Auto / CarPlay",
  "Cruise control",
  "Alloy wheels",
  "Fog lights",
  "Electric mirrors",
  "Power windows",
  "Airbags",
  "ABS",
  "Traction control",
  "Third-row seats",
  "Tow bar",
  "Roof rails",
  "Heated seats",
  "360° camera",
  "Lane assist",
] as const;

export const VEHICLE_LIMITS = {
  minYear: 1980,
  maxImages: 20,
  maxVideos: 2,
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  maxPriceKes: 500_000_000,
  maxMileageKm: 2_000_000,
} as const;

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
export const DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
