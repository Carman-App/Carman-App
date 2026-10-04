import type { NextRequest } from "next/server";
import { requireAccount } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { placesConfigured, searchPlaces } from "@/lib/places/google";

// GET /api/v1/places?q=&lat=&lng=&kind=station
// Nearby places (lat/lng, no q) or a typed search (q, biased to lat/lng) for
// the record forms' place sheet. { configured: false } when the server has no
// Places key; the app then offers its own address lookup and typed entry.
export async function GET(req: NextRequest) {
  try {
    await requireAccount(req);
    if (!placesConfigured()) return apiOk({ configured: false, places: [] });

    const sp = req.nextUrl.searchParams;
    const num = (k: string) => {
      const v = Number(sp.get(k));
      return sp.get(k) !== null && Number.isFinite(v) ? v : undefined;
    };
    const query = sp.get("q")?.trim().slice(0, 120) || undefined;
    try {
      const places = await searchPlaces({ query, lat: num("lat"), lng: num("lng"), kind: sp.get("kind") ?? undefined });
      return apiOk({ configured: true, places });
    } catch (e) {
      // A Places outage must not break the form: the sheet still takes typed entry.
      console.warn("[places]", e instanceof Error ? e.message : e);
      return apiOk({ configured: true, places: [], unavailable: true });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
