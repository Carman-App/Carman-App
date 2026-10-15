/**
 * Normalises a Kenyan mobile number to E.164 (+254XXXXXXXXX).
 * Accepts 07XX/01XX local format, 7XX/1XX without the leading zero,
 * 2547XX and +2547XX, with spaces, dashes or brackets in between.
 * Returns null when the input is not a Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const match = /^(?:\+?254|0)?([17]\d{8})$/.exec(digits);
  return match ? `+254${match[1]}` : null;
}

/** +254712345678 -> 254712345678, the MSISDN format M-Pesa Daraja expects. */
export function toMsisdn(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** wa.me links need the number without the plus sign. */
export function whatsappLink(e164: string, message?: string): string {
  const base = `https://wa.me/${toMsisdn(e164)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
