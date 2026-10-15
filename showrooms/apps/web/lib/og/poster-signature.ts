import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Must match the API's signPosterUrl (HMAC-SHA256 of "<vehicleId>.<exp>", base64url). */
export function verifyPosterSignature(vehicleId: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  const secret = process.env.POSTER_SIGNING_SECRET;
  if (!secret || !exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < now) return false;
  const expected = createHmac("sha256", secret).update(`${vehicleId}.${exp}`).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
