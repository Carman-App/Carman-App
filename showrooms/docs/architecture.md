# Architecture

```
 Expo app (Android/iOS)              Next.js 16 (web)
  SecureStore refresh token           server-rendered public pages (anonymous, cached)
  X-Client-Type: mobile               client dashboards + /admin (TanStack Query)
            \                         /api/posters/:id (1080×1920 Status posters)
             \                       /
              +-- Express API /api/v1 --+
                         |
      MongoDB (replica set) · Cloudinary · Daraja · Resend · Expo Push
```

All business rules and authorization live in the API. Web and mobile share
request schemas, enums, labels, KES formatting and the WhatsApp message
builder through `@showrooms/shared` (isomorphic TypeScript, no Node APIs), so
validation errors, filters and share text are identical on both clients.

## API modules (`apps/api/src/modules`)

| Module | Responsibility |
| ------ | -------------- |
| auth | register/login/refresh/logout/reset; refresh-token families; password hashing |
| users | profile |
| sellers | **seller context**: broker vs dealer (owner/manager/sales), inventory scoping, public showroom routes, follows |
| vehicles | listing lifecycle, search, similar, view/contact tracking, poster links |
| uploads | signed Cloudinary uploads scoped to the owning entity's folder; server-side confirmation |
| inquiries | viewing requests and questions, lead status |
| favorites | saved vehicles + follows models |
| reviews | reviews gated on a real inquiry |
| reports | listing reports and auto-flagging |
| brokers / dealers | profile models, verification (encrypted ID numbers), dealer staff |
| subscriptions | DB-configured plans, entitlements, subscribe |
| payments | M-Pesa STK push, callback verification, at-most-once activation, reconciliation |
| boosts | boost/featured purchases and promotion windows |
| notifications | in-app + Expo push + email |
| analytics | seller and admin aggregation pipelines |
| admin | moderation, verification review, reports, payments, plans, categories, settings, audit |
| categories / settings | admin-managed makes/models/body types; platform rules |

Each module keeps `model → service → routes/controller`; services take plain
inputs and a `SellerContext`/`AuthContext`, never Express objects.
`handler({ body, query, params }, fn)` Zod-parses every request part.
OpenAPI is generated from the same Zod schemas (`/api/docs`).

External services sit behind interfaces in `src/services` (`EmailService`,
`MediaService`, `MpesaService`, `PushService`) with real, disabled and test
implementations, swapped via `setServices()` in tests.

## Listing lifecycle

```
DRAFT ──submit──► PENDING_REVIEW ──approve──► ACTIVE ──mark sold──► SOLD
  │                   │   ▲                      │  ▲
  │                   │   └──── resubmit ────────┤  └── reinstate ── SUSPENDED
  │                   └─reject / changes─► REJECTED                    ▲
  └── delete (drafts only)            any submitted ──archive──► ARCHIVED   └ suspend
```

- Submit checks completeness (`publishableVehicleSchema`), ≥1 photo, the plan's
  active-listing limit, and duplicate fingerprints (make/model/year/mileage
  bucket/colour) — duplicates are flagged for admins.
- `requireListingApproval` and `autoApproveVerifiedSellers` are admin settings.
- Changing make/model/year on a live listing sends it back to review.
- Every decision is stored in `moderationHistory` and the audit log.

## Search and ranking

Filters map to index-backed fields (`status` first in every compound index,
lowercase `makeKey`/`modelKey`). `recommended` sorts by `promotionRank`
(2 featured, 1 boosted, 0 normal) then `publishedAt`; the job runner resets
expired promotions so the sort stays index-friendly. Text search uses a
weighted text index with a prefix fallback. Popularity = views + 5×contacts +
3×saves + 8×inquiries, updated incrementally.

## Analytics

Views and contact taps are separate collections, de-duplicated per viewer per
Nairobi day (`viewerKey` = user id or a hash of IP + user agent; the raw IP is
not stored). Contact taps are labelled as intent everywhere, never as
conversations or sales. Aggregation pipelines bucket by `Africa/Nairobi`.
Free plans get totals and per-listing numbers; daily series need
`advancedAnalytics`.

## Payments

1. Client asks to subscribe or boost (`Idempotency-Key` header). The server
   creates the Subscription/VehicleBoost (PENDING_PAYMENT) and a Payment with the
   **server-computed** amount, then sends the STK push.
2. Safaricom calls `/payments/mpesa/callback?token=…`. The token (and optional
   IP allowlist) is checked; the callback is matched by Checkout + Merchant
   request ids and stored raw.
3. Success requires the paid amount to match and (by default) a confirming STK
   Query. Then, in one transaction, a conditional update flips the payment from
   PENDING to SUCCESS and activates the plan/boost — so duplicate or concurrent
   callbacks, polling and reconciliation apply it at most once. Receipt numbers
   are unique.
4. Pending payments are reconciled by the job runner, by client polling after
   45 s, or by an admin. Clients never mark anything paid.

## Jobs

`src/jobs` runs every minute on the instance with `JOBS_ENABLED=true`:
expire subscriptions and boosts, clear expired promotions, reconcile stale
payments. Every job is idempotent.

## Clients

**Web**: public pages are server components fetching anonymous, cacheable API
responses (`revalidate`), with dynamic metadata, Open Graph images, JSON-LD,
sitemap and robots. Dashboards and admin are client components behind the
session; the API re-authorizes every call. Uploads go browser → Cloudinary
directly with progress, retry and on-device compression.

**Mobile**: Expo Router groups `(auth)`, `(buyer)` tabs and `(seller)` tabs;
filters live in a Zustand store but serialize to the same query keys as the
web URLs. Lists use FlatList virtualization and `expo-image` disk caching with
480 px CDN renditions. The listing wizard keeps a local draft in
AsyncStorage and a server draft.
