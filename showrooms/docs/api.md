# API

Base URL: `/api/v1`. Interactive docs: `/api/docs` (Swagger UI), spec: `/api/docs.json`.
The spec is generated from the Zod schemas that validate requests, so it can't drift from the code.

## Conventions

| Topic | Rule |
| ----- | ---- |
| Success | `{ data, meta? }` |
| Errors | `{ error: { code, message, details?, requestId } }` |
| Validation | 422 `VALIDATION_ERROR`, `details: [{ path, message }]` |
| Auth | `Authorization: Bearer <accessToken>` |
| Pagination | `?page=1&limit=20` (max 50) → `meta: { page, limit, total, totalPages }` |
| Rate limit | 429 `RATE_LIMITED`, `RateLimit` headers |

Error codes: `VALIDATION_ERROR`, `BAD_REQUEST`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`,
`INVALID_CREDENTIALS`, `ACCOUNT_SUSPENDED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`EMAIL_TAKEN`, `PHONE_TAKEN`, `RATE_LIMITED`, `INTERNAL_ERROR`.

On `401 TOKEN_EXPIRED`, call `/auth/refresh` once and retry the request.

## Endpoints (Phase 1)

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/health` | – | `{ status, db }`, 503 when the DB is down |
| POST | `/auth/register` | – | `role`: BUYER (default), BROKER, DEALER |
| POST | `/auth/login` | – | |
| POST | `/auth/refresh` | cookie or body | Rotates the refresh token |
| POST | `/auth/logout` | cookie or body | 204 |
| POST | `/auth/forgot-password` | – | Always 202 |
| POST | `/auth/reset-password` | – | Revokes all sessions |
| GET | `/auth/me` | user | |
| GET | `/users/me` | user | |
| PATCH | `/users/me` | user | `name`, `phone` (`null` clears) |
| GET | `/admin/users` | admin | `role`, `status`, `q`, pagination |
| PATCH | `/admin/users/:id/status` | admin | `status`, `reason`; ends the user's sessions |

### Web vs mobile sessions

```http
POST /api/v1/auth/login                    # browser
→ Set-Cookie: sr_refresh=...; HttpOnly; Path=/api/v1/auth; SameSite=Lax
→ { data: { user, accessToken, accessTokenExpiresAt } }

POST /api/v1/auth/refresh                  # browser, credentials: "include"
X-Requested-With: showrooms

POST /api/v1/auth/login                    # native app
X-Client-Type: mobile
→ { data: { user, accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt } }

POST /api/v1/auth/refresh                  # native app
{ "refreshToken": "..." }
```
