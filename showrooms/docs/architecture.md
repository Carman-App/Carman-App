# Architecture

```
 Expo mobile (Android/iOS)        Next.js web (public, dashboards, /admin)
            \                                   /
             +--------- Express API /api/v1 ---+
                              |
           MongoDB    Cloudinary    M-Pesa Daraja    Resend    Expo Push
```

All business rules and authorization live in the API. The web and mobile apps
are clients of the same API; they share request schemas and types through
`packages/shared` but never import server code.

## Packages

| Package           | Notes |
| ----------------- | ----- |
| `@showrooms/shared` | Isomorphic only (no Node APIs). Ships TypeScript source: the API bundles it with tsup, Next.js uses `transpilePackages`, Metro compiles it directly. |
| `@showrooms/api`  | Express 5, Mongoose 9, Zod 4, Pino. ESM. Dev via `tsx`, production bundle via `tsup`. |

## API layout

```
src/
  config/       env (validated with Zod), logger, database
  middleware/   auth (authenticate/authorize), rate limits, error handling
  modules/<name>/
    *.model.ts       Mongoose schema + indexes
    *.service.ts     business logic, no Express types
    *.controller.ts  HTTP in/out (thin)
    *.routes.ts      router + OpenAPI description
  services/     external integrations behind interfaces (email; later media, payments, push)
  docs/         OpenAPI generated from the same Zod schemas that validate requests
  utils/        AppError, handler(), token helpers
```

`handler({ body, query, params }, fn)` parses each part with Zod before the
controller runs; failures become a 422 with field-level details.

### Responses

- Success: `{ "data": ..., "meta": { page, limit, total, totalPages }? }`
- Error: `{ "error": { "code", "message", "details"?, "requestId" } }`

Every response carries `X-Request-Id`, which also appears in logs.

## Authentication

- **Access token**: HS256 JWT, 15 minutes, `{ sub, role }`, issuer/audience checked.
  Every authenticated request reloads the user's role and status from MongoDB,
  so a suspension, role change or password reset takes effect immediately; the
  role in the token is never trusted on its own.
- **Refresh token**: 48 random bytes, stored only as a SHA-256 hash, 30 days.
  Rotated on every use. Each login starts a token *family*; presenting a token
  that was already rotated revokes the whole family (theft detection) and is
  audited. Rotation is claimed atomically, so two concurrent refreshes cannot
  both succeed — clients must single-flight their refresh calls.
- **Browsers** get the refresh token as an `HttpOnly`, `SameSite=Lax`, `Secure`
  (production) cookie scoped to `/api/v1/auth`; the access token lives in memory
  only, never `localStorage`. Cookie-based refresh/logout also require
  `X-Requested-With: showrooms`, which forces a CORS preflight that only
  allowlisted origins pass.
- **Native apps** send `X-Client-Type: mobile`, receive the refresh token in the
  response body and keep it in Expo SecureStore.
- **Password reset**: single-use hashed token (30 min) emailed via the email
  service; the response is identical whether or not the email exists. A reset
  revokes every refresh token and invalidates older access tokens.
- Login compares against a dummy hash for unknown emails so response time does
  not reveal which emails are registered.
- Adding phone OTP or social login later means adding a new way to prove
  identity that ends in the same `issueSession()`; tokens and sessions don't change.

## Roles

`BUYER`, `BROKER`, `DEALER`, `ADMIN`. Sign-up accepts only the first three.
`ADMIN` is created by `scripts/create-admin.ts` with database access. Admins
cannot change their own status or another admin's. Dealer staff accounts arrive
with the dealers module: a staff member is linked to one dealer profile and
every dealer-scoped query filters by that dealer.

## Security controls in place

Helmet headers, CORS allowlist, 100 kB JSON limit, Zod validation (unknown keys
stripped, so `role`/`status`/`passwordHash` in a body are ignored), bcrypt (12
rounds), rate limits (general, auth, and login/register/reset keyed by
IP + email), audit log for auth and admin actions, log redaction of
authorization headers, cookies, passwords and tokens.

Rate limits use an in-memory store. Behind more than one API instance, switch to
a shared store (Redis) so limits apply globally.

## Data

Collections so far: `users`, `refreshtokens`, `passwordresettokens`,
`auditlogs`. Expiring tokens are removed by TTL indexes. Phone numbers are
stored in E.164 (`+2547...`) and are unique when present.

Local MongoDB runs as a single-node replica set so later phases can use
transactions (payment activation).
