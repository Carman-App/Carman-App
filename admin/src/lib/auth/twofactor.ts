import "server-only";
import { randomBytes } from "crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { hashPassword, verifyPassword } from "./password";

// TOTP-based 2FA (AUD-05). No external provider needed — `otpauth` generates
// and verifies standard RFC 6238 codes compatible with Google
// Authenticator/Authy/1Password etc. `qrcode` renders the otpauth:// URI as
// a scannable PNG data URI for setup; manual entry (the raw secret) is
// always shown alongside it for authenticators that can't scan.

const ISSUER = "Carma Admin";
const BACKUP_CODE_COUNT = 8;

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function buildTotp(email: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

export async function generateSetupQrCode(email: string, secret: string): Promise<string> {
  const totp = buildTotp(email, secret);
  return QRCode.toDataURL(totp.toString(), { margin: 1, width: 240 });
}

/**
 * Verifies a 6-digit code against the secret, allowing ±1 time step (30s)
 * of clock drift. Returns true/false — never throws on a bad code.
 */
export function verifyTotpCode(email: string, secret: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const totp = buildTotp(email, secret);
  const delta = totp.validate({ token: cleaned, window: 1 });
  return delta !== null;
}

/** Plain-text backup codes to show once at setup time, plus their bcrypt hashes to store. */
export async function generateBackupCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
  );
  const hashed = await Promise.all(plain.map((code) => hashPassword(code)));
  return { plain, hashed };
}

/**
 * Checks a submitted backup code against the stored hashes. Returns the
 * remaining hash list (with the matched code removed — one-time use) if it
 * matched, or null if it didn't match any.
 */
export async function consumeBackupCode(
  submitted: string,
  storedHashes: string[],
): Promise<string[] | null> {
  const cleaned = submitted.trim().toUpperCase();
  for (let i = 0; i < storedHashes.length; i++) {
    if (await verifyPassword(cleaned, storedHashes[i])) {
      return [...storedHashes.slice(0, i), ...storedHashes.slice(i + 1)];
    }
  }
  return null;
}
