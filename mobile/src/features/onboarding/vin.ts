/** A VIN from a barcode: 17 characters, no I, O or Q (Code 39 labels often add a leading I). */
export function vinFromBarcode(data: string): string | null {
  let v = data.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (v.length === 18 && v.startsWith('I')) v = v.slice(1);
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : null;
}

/** A typed VIN cleaned up: capitals, no spaces, and none of I, O, Q (never used in VINs). */
export function cleanVin(v: string): string {
  return v.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
}
