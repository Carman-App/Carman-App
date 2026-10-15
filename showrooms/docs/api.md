# API reference

Base URL `/api/v1`. Interactive docs at `/api/docs` (Swagger UI) and
`/api/docs.json` (OpenAPI 3.1), generated from the Zod schemas that validate
requests; disabled when `APP_ENV=production`.

## Conventions

| | |
| - | - |
| Success | `{ "data": …, "meta"?: { page, limit, total, totalPages, … } }` |
| Error | `{ "error": { "code", "message", "details"?, "requestId" } }` (`X-Request-Id` on every response) |
| Validation | 422 `VALIDATION_ERROR`, `details: [{ path, message }]` |
| Auth | `Authorization: Bearer <accessToken>`; on 401 `TOKEN_EXPIRED` refresh once and retry |
| Pagination | `?page=1&limit=20` |
| Idempotency | `Idempotency-Key` on payment-creating calls (subscribe, boost, STK retry) |
| Caching | everything `private, no-store` except anonymous listing reads (`public, max-age=30–300`, `Vary: Authorization`) |
| Compression | gzip for responses over 1 KB |

Error codes: `VALIDATION_ERROR` `BAD_REQUEST` `UNAUTHENTICATED` `TOKEN_EXPIRED`
`INVALID_CREDENTIALS` `ACCOUNT_SUSPENDED` `FORBIDDEN` `NOT_FOUND` `CONFLICT`
`EMAIL_TAKEN` `PHONE_TAKEN` `RATE_LIMITED` `INTERNAL_ERROR`.
A plan limit is `403 FORBIDDEN` with `details.reason = "PLAN_LIMIT"`.

## Sessions

Browsers get the refresh token as an HttpOnly, `SameSite=Lax` cookie scoped to
`/api/v1/auth` and must send `X-Requested-With: showrooms` on refresh/logout.
Native apps send `X-Client-Type: mobile` and receive `refreshToken` in the
body. Refresh tokens rotate on every use; replaying an old one ends the
whole session family.

## Endpoints

Legend: — public · U any signed-in user · S broker/dealer · O dealer owner · A admin.

### Auth & users
| | | |
|-|-|-|
| POST | /auth/register | — role BUYER (default) / BROKER / DEALER |
| POST | /auth/login · /auth/refresh · /auth/logout | — |
| POST | /auth/forgot-password · /auth/reset-password | — |
| GET | /auth/me · /users/me | U |
| PATCH | /users/me | U name, phone |

### Vehicles
| | | |
|-|-|-|
| GET | /vehicles | — `q make model minPrice maxPrice minYear maxYear maxMileage town fuelType transmission bodyType driveType condition importStatus sellerId dealerId featured sort page limit` |
| GET | /vehicles/:idOrSlug | — (owner/admin also see non-public statuses and stats) |
| GET | /vehicles/:id/similar | — |
| GET | /vehicles/mine | S `status q page` (+ `meta.statusCounts`) |
| POST | /vehicles | S create draft |
| PATCH | /vehicles/:id | S fields, `imageOrder`, `videoOrder` |
| DELETE | /vehicles/:id | S delete draft / archive |
| POST | /vehicles/:id/submit · /mark-sold | S |
| POST | /vehicles/:id/view · /contact | — `{ channel: WHATSAPP \| CALL }` |
| GET | /vehicles/:id/poster | S (plan feature) → signed poster URL |
| POST | /vehicles/:vehicleId/inquiries | U viewing request or question |
| POST | /vehicles/:vehicleId/reports | U |
| POST | /vehicles/:vehicleId/boost | S `{ packageCode, phone }` |

### Showrooms
| | | |
|-|-|-|
| GET | /brokers · /dealers | — `q town verified page` |
| GET | /brokers/:slug · /dealers/:slug | — (+ `isFollowing` when signed in) |
| GET/PATCH | /brokers/me · /dealers/me | S (dealer PATCH: owner) |
| GET/POST | /brokers/verification · /dealers/verification | S/O |
| POST/DELETE | /{brokers,dealers}/:slug/follow | U |
| GET/POST | /{brokers,dealers}/:slug/reviews | — / U (needs a prior inquiry) |
| GET | /{brokers,dealers}/:slug/can-review | U |
| GET/POST/PATCH/DELETE | /dealers/me/staff[/:userId] | O |
| GET | /follows | U |

### Engagement
| | | |
|-|-|-|
| GET | /favorites · /favorites/ids | U |
| POST/DELETE | /favorites/:vehicleId | U |
| GET | /inquiries/me | U |
| GET | /broker/inquiries | S |
| PATCH | /broker/inquiries/:id | S (plan feature: lead tracking) |
| GET | /notifications · /notifications/unread-count | U |
| PATCH | /notifications/:id/read · POST /notifications/read-all | U |
| POST/DELETE | /notifications/push-tokens | U |
| GET | /analytics/seller?days= | S |
| GET | /categories | — |

### Media
| | | |
|-|-|-|
| POST | /uploads/signature | U `{ purpose, vehicleId?, contentType, fileSize }` |
| POST | /uploads/complete | U `{ purpose, vehicleId?, publicId }` |

Purposes: `VEHICLE_IMAGE` (≤10 MB), `VEHICLE_VIDEO` (≤100 MB), `AVATAR`,
`PROFILE_LOGO`, `PROFILE_COVER`, `VERIFICATION_DOC` (private delivery).

### Billing
| | | |
|-|-|-|
| GET | /subscriptions/plans | — `?audience=BROKER\|DEALER` |
| POST | /subscriptions | S `{ planCode, phone? }` |
| GET | /subscriptions/me | S |
| GET | /boosts/packages | — |
| GET | /boosts/me | S |
| POST | /payments/mpesa/stk-push | S retry a pending subscription/boost |
| POST | /payments/mpesa/callback?token= | Safaricom only |
| GET | /payments/me · /payments/:id | U (own) |

### Admin (all A)
`GET /admin/overview`, `/admin/analytics`, `/admin/users[/:id]`,
`PATCH /admin/users/:id/status`, `GET /admin/brokers`, `/admin/dealers`,
`GET /admin/verifications[/:id]`, `POST /admin/verifications/:id/decision`,
`GET /admin/vehicles[/:id]`, `POST /admin/vehicles/:id/{moderate,feature,verify}`,
`GET /admin/reports`, `PATCH /admin/reports/:id`, `PATCH /admin/reviews/:id`,
`GET /admin/payments[/:id]`, `POST /admin/payments/:id/reconcile`,
`GET /admin/subscriptions`, `POST /admin/subscriptions/:id/cancel`,
`GET/POST/PATCH /admin/plans`, `GET/POST/PATCH /admin/categories`,
`GET /admin/audit-logs`, `GET/PATCH /admin/settings`.

### Health
`GET /health` → `{ status, db }` (503 when MongoDB is down).
