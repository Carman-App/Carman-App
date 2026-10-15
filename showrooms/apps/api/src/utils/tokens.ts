import { createHash, randomBytes } from "node:crypto";

/** High-entropy opaque token for refresh and password-reset flows. */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

/** Only hashes are stored, so a database leak does not leak usable tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
