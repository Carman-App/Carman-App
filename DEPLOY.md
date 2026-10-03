# Deploying Carma

How to run Carma in production, what each piece is for, and how to scale it.
Everything here is provider-neutral; any platform that runs Docker containers
and offers managed Postgres and Redis works.

## What runs

| Piece | What it is | How many |
|---|---|---|
| **API + console** (`admin/`, Docker target `web`) | Next.js server: the mobile API (`/api/v1/*`), the admin console, `/api/health` | 2 or more, behind a load balancer. One Node process uses one CPU core, so size instances at 1 vCPU and add instances to scale. |
| **Worker** (`admin/`, Docker target `worker`, `npm run worker`) | Background jobs: notification delivery, the daily reminder scan (03:15 EAT), data exports | 1 to start; add more when the queue backs up |
| **Postgres 16** | All data | Managed, with automated backups and point-in-time recovery |
| **Connection pooler** | PgBouncer in *transaction* mode, or your provider's pooled connection string | 1 (often built into the provider) |
| **Read replica** (optional at first) | Serves the console's reporting screens (Pulse, Growth, data quality, revenue) | Add when the primary gets busy |
| **Redis 7** | Rate limits, caches, the job queue | Managed; persistence on; `maxmemory-policy noeviction` (the queue must not be evicted) |
| **Object storage** | Document photos and PDFs (S3, Cloudflare R2, …) | 1 private bucket |
| **Mobile app** (`mobile/`) | Built with EAS (`mobile/eas.json`) | — |

## Deploy steps

1. **Create the services:** Postgres, Redis and a private bucket. Note the
   pooled *and* direct Postgres URLs.
2. **Build the images** from `admin/`:
   `docker build --target web -t carma-web .` and `--target worker -t carma-worker .`
   (If Docker Hub rate-limits your builder, pass
   `--build-arg NODE_IMAGE=<mirror>/node:22-slim`.)
3. **Run migrations** once per release with the *direct* (unpooled) URL:
   `docker run --rm -e DATABASE_URL=<direct url> carma-worker npx prisma migrate deploy`
4. **Seed plans once** (safe to re-run; never overwrites prices):
   `docker run --rm -e DATABASE_URL=<direct url> carma-worker npm run seed`
   It loads plans and settings only; `npm run seed:demo` adds a demo account (never in production).
5. **Create the first admin:** `npm run create-admin` asks for the email, name
   and password (locally, or `docker run -it … carma-worker npm run create-admin`).
   Unattended: set `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` and run
   `npm run create-admin -- --from-env`. Run it again with the same email to
   change the password or reset two-factor for someone who lost their phone. Create a **second** admin:
   deleting accounts, exporting data, publishing config and changing roles all
   need a second admin to approve (Console → Approvals).
6. **Start** the web service (port 3000, health check `GET /api/health`) and
   the worker, both with the environment below.
7. **Point the app at the API:** set `EXPO_PUBLIC_API_URL` in the EAS
   environment and build (`eas build --profile production`).

## Environment (API and worker)

Locally, `npm run setup:db` (in `admin/`) creates the `carma` database user and
database on your Postgres, writes `DATABASE_URL`, runs the migrations and
loads the plans and settings (it asks once for the Postgres admin password).
Locally, `node scripts/setup-env.mjs` (from the repo root) creates or updates
`admin/.env` and `mobile/.env.local` from the `.env.example` files: it adds
missing settings, generates the secrets, clears example placeholders and never
changes a value you set.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | **Pooled** URL (PgBouncer, transaction mode). Supabase: *Transaction pooler*, port 6543, `?sslmode=require` |
| `DIRECT_DATABASE_URL` | with a pooler | Direct URL that `prisma migrate deploy` uses. Supabase: *Session pooler*, port 5432 |
| `DATABASE_POOL_MAX` | no | Connections per instance to the pooler. Default 10 |
| `DATABASE_READ_URL` | no | Read replica for reporting screens |
| `REDIS_URL` | yes | Without it, limits and caches are per instance and jobs run inside the API |
| `AUTH_JWT_SECRET` | yes | ≥ 32 random chars (`openssl rand -base64 48`). Rotating it signs everyone out |
| `SESSION_SECRET` | yes | Admin console sessions |
| `GOOGLE_CLIENT_IDS` | for Google | iOS, Android and web OAuth client ids, comma-separated |
| `APPLE_AUDIENCES` | for Apple | The iOS bundle id (plus a Services ID for web) |
| `CORS_ALLOWED_ORIGINS` | yes | Browser origins allowed to call the API. Native apps don't need one |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` | for files | Private bucket. `S3_ENDPOINT` for R2/MinIO |
| `ANTHROPIC_API_KEY` | for the assistant | Server only |
| `REVENUECAT_SECRET_API_KEY` | for subscriptions | RevenueCat secret key (`sk_…`): the server reads purchases with it |
| `REVENUECAT_WEBHOOK_AUTH` | for subscriptions | Same value as the webhook's Authorization header in RevenueCat |
| `EXPO_ACCESS_TOKEN` | no | Only if enhanced push security is on at expo.dev |
| `PUSH_NOTIFICATIONS` | no | `off` stops push sending (staging copies of real data) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` | recommended | Error monitoring |
| `RATE_LIMIT_API`, `RATE_LIMIT_WRITE`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_ANON` | no | Per minute (auth: per 5 min). Defaults 600 / 120 / 30 / 120 |
| `WORKER_CONCURRENCY` | no | Jobs processed at once per worker. Default 10 |
| `ALLOW_DEV_ACCOUNT_HEADER` | **never in production** | Ignored anyway when `NODE_ENV=production` |

Mobile (EAS environment): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`,
`EXPO_PUBLIC_IOS_BUNDLE_ID`, `EXPO_PUBLIC_ANDROID_PACKAGE`, `EXPO_PUBLIC_SENTRY_DSN`,
`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EAS_PROJECT_ID`,
and the file variable `GOOGLE_SERVICES_JSON` (Android push).
Do **not** set `EXPO_PUBLIC_DEV_ACCOUNT_ID` for production builds.

## Using Supabase for Postgres

Carma talks to Postgres directly (Prisma), so it needs Supabase's **database
connection strings**, not the project URL or publishable/anon key (those are
for Supabase's client libraries, which Carma doesn't use).

**Quickest:** in `admin/` run `npm run setup:supabase`. It asks
for the project URL and the database password, finds the region, writes both
URLs into `admin/.env`, runs the migrations and the seed, and (if you give it
S3 keys from Storage → S3 Connection) sets up document storage on Supabase
Storage with a private `documents` bucket.

By hand:

1. Supabase dashboard → your project → **Connect** (top bar).
2. Copy the **Transaction pooler** string (port 6543) into `DATABASE_URL` and
   the **Session pooler** string (port 5432) into `DIRECT_DATABASE_URL`, in
   `admin/.env`. Replace `[YOUR-PASSWORD]` with the database password
   (Project Settings → Database → Reset database password if you don't have
   it; URL-encode characters like `@ # / ?`). Add `?sslmode=require` to both.
3. From `admin/`: `npx prisma migrate deploy`, then `npx tsx prisma/seed.ts`.

Supabase gives each project its own Postgres; you don't need
`npm run setup:db` (that is for a Postgres on your own computer).

## Sign-in setup

- **Google:** in Google Cloud Console create OAuth clients for iOS, Android
  (with your signing SHA-1) and Web. The app uses the Web client id to get an
  ID token; put all three ids in `GOOGLE_CLIENT_IDS`.
- **Apple:** enable *Sign in with Apple* on the App ID. The app already
  declares the capability (`mobile/app.config.ts`). Put the bundle id in
  `APPLE_AUDIENCES`.
- Both need a development or store build. Expo Go cannot do native sign-in.

## Subscriptions setup (App Store / Google Play)

Plans are sold through the stores' own billing, with RevenueCat in between
(free up to a revenue threshold; it validates receipts and tells the server
about renewals, cancellations and refunds).

1. **Create the products** in App Store Connect (one subscription group,
   "Carma") and in Play Console (Monetize → Subscriptions), with these ids:
   `carma_personal_monthly`, `carma_personal_annual`, `carma_pro_monthly`,
   `carma_pro_annual` (owner plans) and `carma_workshop_monthly`,
   `carma_workshop_annual`, `carma_fleet_monthly`, `carma_fleet_annual`
   (workshop plans). Prices are set there, per country. The ids are on each
   plan (`Plan.storeProductIds`, set by the seed); change them there if you
   use others.
2. **RevenueCat:** create a project, add the iOS and Android apps (App Store
   Connect API key / Play service account, as RevenueCat's setup asks), and
   import the products.
3. **Keys:** the public app keys go in the app (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`); the secret key goes on the server
   (`REVENUECAT_SECRET_API_KEY`).
4. **Webhook:** RevenueCat → Integrations → Webhooks: URL
   `https://<your-api>/api/v1/billing/revenuecat`, Authorization header =
   `REVENUECAT_WEBHOOK_AUTH`. Send a test event; it should return 200.
5. Test with sandbox / license-tester accounts in a development build.

How it works: the app buys as the Carma account id; the server never trusts
the app, it reads the purchase from RevenueCat (`src/lib/billing/store.ts`)
and updates the Subscription row, its history and the plan limits. Plans set
from the console (no store) are never touched by store syncs.

## Push notifications setup

Sent through Expo's push service, which delivers to Apple and Google.

1. `cd mobile && npx eas init` once; put the project id in `EAS_PROJECT_ID`.
2. **iOS:** `eas credentials` → iOS → Push Notifications: let EAS create the
   push key (or upload yours).
3. **Android:** create a Firebase project with the Android package, download
   `google-services.json`, upload it as the EAS file variable
   `GOOGLE_SERVICES_JSON`, and upload the Firebase service-account key
   (FCM V1) in `eas credentials` → Android → Push Notifications.
4. Build a development or store build (Expo Go cannot receive push). The app
   asks permission when set-up is done and registers the phone; settings in
   My profile → Notifications decide which kinds are pushed. Every
   notification also appears in the in-app list.

## Test accounts (development)

`npm run test-accounts` (in `admin/`) creates five people to try the app as:
a new owner (set-up from the start), an owner with two vehicles and history,
a member of that garage, a mechanic with a workshop and an open job, and an
owner whose trial is over at the Free plan's limit. Run it again to reset
them; `npm run test-accounts -- --remove` deletes them. In the app (a
development build or Expo Go, not signed in): My profile → Test accounts.
The list only exists under `npm run dev`; never run the script on production.

## Starting over (delete all data)

`npm run db:wipe` (in `admin/`) deletes every account and everything people
recorded from the database in `DATABASE_URL`, after you type the database's
name to confirm. Admin logins, the audit log, plans, prices and console
settings are kept. Files in the storage bucket are not touched. It cannot be
undone, so check `DATABASE_URL` points where you think it does.

## Security checklist

- HTTPS only (the API sends HSTS). Terminate TLS at the load balancer.
- Secrets in the platform's secret store, never in the repo. `.env` files are git-ignored.
- Postgres and Redis on a private network, not reachable from the internet.
- The bucket is private; files are served through 10-minute signed links after an access check.
- Backups: automated daily plus point-in-time recovery; test a restore every quarter
  (the console's System page records the last restore test).
- Admin console: every admin uses 2FA (enforced at sign-in).

## Scaling

Measured on a 4-core machine with a production build (the load generator ran
on the same machine, so real servers do better): **350–420 requests/second
per instance** on the main reads, no errors, p99 under 250 ms. The framework
itself peaks near 730 req/s per process.

Rough sizing: an active user opening the app makes 6–10 requests. One
million daily active users at ~20 sessions a day is roughly 2,000–3,000
requests/second at peak, so **8–12 API instances (1 vCPU each)**, a pooler
in front of a 4–8 vCPU Postgres with a read replica, a small Redis, and
2 workers. Measure before buying: run the load test.

What already keeps load down:
- Last-active is written at most once per 15 minutes per account.
- Plan checks and the console's Pulse are cached for 60 seconds in Redis.
- The vehicle timeline is one indexed query, paginated in the database.
- Uploads go straight to storage; slow work runs in the worker.
- Assistant answers are cached for 10 minutes and capped per plan each month.

## Load testing

Use a staging copy, never production data:

```
BASE_URL=https://staging.example.com TOKENS=<token1>,<token2> \
GARAGE_ID=<id> VEHICLE_ID=<id> PEAK_VUS=200 k6 run loadtest/api.k6.js
```

The run fails if p95 latency goes over 500 ms or more than 1% of requests
fail. Raise `PEAK_VUS` step by step; watch database CPU and the pooler's
waiting clients. When the database is the limit, add the read replica and
move more read paths to `prismaRead`.

## Local production-like stack

`docker compose up --build` runs Postgres, PgBouncer, Redis, migrations, two
API instances (ports 3001 and 3002) and the worker.
