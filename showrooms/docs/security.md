# Security

## Controls

| Area | Control |
| ---- | ------- |
| Passwords | bcrypt (12 rounds, min 10 outside development), 8–72 bytes with a letter and a digit; constant-time handling of unknown emails |
| Sessions | 15-minute HS256 access JWTs (issuer/audience checked); 30-day opaque refresh tokens stored as SHA-256 hashes, rotated on every use, family revoked on reuse; all sessions revoked on password reset, suspension or staff removal |
| Browser tokens | Access token in memory only; refresh token HttpOnly + `SameSite=Lax` + `Secure` cookie on `/api/v1/auth`; cookie use needs `X-Requested-With` (forces CORS preflight) |
| Mobile tokens | Refresh token in Expo SecureStore (Keystore/Keychain, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) |
| Authorization | Role and status reloaded from MongoDB on every request; `authorize()` on routes; ownership enforced in services via `SellerContext` (other sellers' resources return 404); dealer staff scoped to one dealership; admin cannot self-register, change their own status or another admin's |
| Input | Zod on every body/query/param; unknown keys stripped, so `role`, `status`, `sellerId`, prices of plans etc. from clients are ignored; 100 KB JSON limit |
| Money | Amounts computed server-side from DB plans/packages; activation only after token-checked callback + amount match + STK Query, inside a transaction with a conditional status update; unique receipt numbers; full callback history kept |
| Uploads | Signed parameters per entity folder with random public ids and no overwrite; MIME/size checked before signing and re-checked with the provider after upload (oversize/unknown formats deleted); verification documents use private delivery and 10-minute signed links |
| Sensitive data | ID numbers and KRA PINs AES-256-GCM encrypted; only admins can decrypt and every view is audited; log redaction of auth headers, cookies, passwords and tokens; viewer IPs hashed for analytics |
| Abuse | Rate limits (general, auth, and login/register/reset per IP+email); inquiry daily cap; one open report per listing per user; auto-flag on repeated reports; duplicate listing detection |
| HTTP | Helmet headers, CORS allowlist, HSTS, `X-Frame-Options: DENY` on web, `no-store` on private API responses and dashboards |
| Audit | Append-only audit log for auth events, moderation, verification, payments, plan/settings changes |
| Secrets | Server-only env; validated at boot; no secrets in `NEXT_PUBLIC_*`/`EXPO_PUBLIC_*` |

## Known limitations and follow-ups

- Rate-limit counters are in memory; use a shared store (Redis) before running
  more than one API instance.
- No Content-Security-Policy on the web app yet (needs nonce support for
  Next.js inline scripts).
- Email and phone verification flows (`emailVerifiedAt`, `phoneVerifiedAt`) are
  modelled but not yet enforced; phone OTP slots in as another way to call
  `issueSession()`.
- `pnpm audit --prod` (October 2026): the API and web have no advisories.
  Six advisories sit in the mobile toolchain — `node-forge` (Expo CLI dev
  server), `braces` (Metro), `uuid` (config plugins), `sprintf-js` (Jest),
  `postcss-selector-parser` (Tailwind build) — none of which ship in the app
  bundle, plus `decode-uri-component` under Expo Router's `query-string`
  (moderate, malformed-URI DoS). None has a fix within Expo SDK 57; re-check
  when upgrading the SDK.
