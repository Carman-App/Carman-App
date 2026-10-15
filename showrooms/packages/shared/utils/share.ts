import { formatEngine, formatKes, formatMileage, label, vehicleTitle } from "./format";

export interface ShareableVehicle {
  year: number;
  make: string;
  model: string;
  price: number;
  priceNegotiable?: boolean;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  engineCapacity?: number;
  condition?: string;
  location?: { town: string; area?: string };
}

/**
 * The text a seller shares to WhatsApp (chat, group or Status caption).
 * Used by both web and mobile so the message is identical everywhere.
 * We only ever open WhatsApp/the share sheet with this prefilled; the seller sends it.
 */
export function buildWhatsAppShareMessage(vehicle: ShareableVehicle, listingUrl: string, sellerName: string): string {
  const specs = [
    vehicle.mileage !== undefined ? formatMileage(vehicle.mileage) : null,
    vehicle.transmission ? label("transmission", vehicle.transmission) : null,
    vehicle.fuelType ? label("fuelType", vehicle.fuelType) : null,
    vehicle.engineCapacity ? formatEngine(vehicle.engineCapacity) : null,
    vehicle.condition ? label("condition", vehicle.condition) : null,
  ].filter(Boolean);

  const location = vehicle.location ? [vehicle.location.area, vehicle.location.town].filter(Boolean).join(", ") : null;

  return [
    `🚗 *${vehicleTitle(vehicle)}*`,
    `💰 ${formatKes(vehicle.price)}${vehicle.priceNegotiable ? " (negotiable)" : ""}`,
    location ? `📍 ${location}` : null,
    specs.length ? `⚙️ ${specs.join(" · ")}` : null,
    "",
    `More photos and details: ${listingUrl}`,
    "",
    `— ${sellerName}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Message a buyer sends when tapping "WhatsApp seller". */
export function buildBuyerEnquiryMessage(vehicle: { year: number; make: string; model: string; price: number }, listingUrl: string): string {
  return `Hi, I'm interested in the ${vehicleTitle(vehicle)} listed at ${formatKes(vehicle.price)} on Showrooms. Is it still available?\n${listingUrl}`;
}
