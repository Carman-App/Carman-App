/**
 * Small, deterministic content fingerprint (two FNV-1a passes → 16 hex
 * chars). Used to tell whether the same report would now come out
 * differently (SYS-05) — change detection, not security. Deliberately never
 * printed as a "verification code": the brief parks verification.
 */
export function fingerprint(text: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x5bd1e995
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13)
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0')
}

/** Stable 6-character reference for an id, e.g. an invoice ("INV-K3F9QA"). */
export function shortRef(id: string): string {
  return parseInt(fingerprint(id).slice(0, 8), 16).toString(36).toUpperCase().padStart(6, '0').slice(-6)
}
