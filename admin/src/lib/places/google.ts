import "server-only";

/**
 * Place search for the record forms' place sheet ("Use my current location",
 * nearby places, typed entry), through Google Places API (New). The key stays
 * on the server: set GOOGLE_PLACES_API_KEY to turn it on. Without it the app
 * still works: the sheet offers the phone's own address lookup, places the
 * owner used before, and whatever they type.
 */

export type PlaceHit = { id: string; name: string; address: string; distanceM?: number };

const BASE = "https://places.googleapis.com/v1/places";
const FIELDS = "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location";

/** What the field is for decides which kind of place is worth showing nearby. */
export const PLACE_KINDS: Record<string, string[]> = {
  station: ["gas_station", "electric_vehicle_charging_station"],
  workshop: ["car_repair", "car_dealer"],
  supplier: ["auto_parts_store", "car_repair", "car_dealer"],
  wash: ["car_wash"],
  parking: ["parking"],
};

export function placesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

type Raw = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
};

function metres(a: { lat: number; lng: number }, b: { latitude: number; longitude: number }) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.lat);
  const dLng = rad(b.longitude - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

async function call(path: string, body: unknown): Promise<Raw[]> {
  const res = await fetch(`${BASE}:${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Places ${path} failed: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
  const json = (await res.json()) as { places?: Raw[] };
  return json.places ?? [];
}

export async function searchPlaces(input: { query?: string; lat?: number; lng?: number; kind?: string }): Promise<PlaceHit[]> {
  const here = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined;
  const circle = here ? { circle: { center: { latitude: here.lat, longitude: here.lng }, radius: 5000 } } : undefined;

  let raw: Raw[];
  if (input.query) {
    raw = await call("searchText", { textQuery: input.query, pageSize: 8, ...(circle ? { locationBias: circle } : {}) });
  } else if (circle) {
    const types = PLACE_KINDS[input.kind ?? ""];
    raw = await call("searchNearby", {
      maxResultCount: 8,
      rankPreference: "DISTANCE",
      locationRestriction: circle,
      ...(types ? { includedTypes: types } : {}),
    });
  } else {
    return [];
  }

  return raw
    .filter((p) => p.displayName?.text)
    .map((p) => ({
      id: p.id,
      name: p.displayName!.text!,
      address: p.shortFormattedAddress || p.formattedAddress || "",
      distanceM: here && p.location ? metres(here, p.location) : undefined,
    }));
}
