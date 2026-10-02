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
   The seed also creates a demo account. Delete it in production, or seed plans only.
5. **Create the first admin:** `npm run create-admin` in the worker image with
   `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` set. Create a **second** admin:
   deleting accounts, exporting data, publishing config and changing roles all
   need a second admin to approve (Console → Approvals).
6. **Start** the web service (port 3000, health check `GET /api/health`) and
   the worker, both with the environment below.
7. **Point the app at the API:** set `EXPO_PUBLIC_API_URL` in the EAS
   environment and build (`eas build --profile production`).

## Environment (API and worker)

Locally, `node scripts/setup-env.mjs` (from the repo root) creates or updates
`admin/.env` and `mobile/.env.local` from the `.env.example` files: it adds
missing settings, generates the secrets, clears example placeholders and never
changes a value you set.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | **Pooled** URL (PgBouncer, transaction mode) |
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
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT` | recommended | Error monitoring |
| `RATE_LIMIT_API`, `RATE_LIMIT_WRITE`, `RATE_LIMIT_AUTH`, `RATE_LIMIT_ANON` | no | Per minute (auth: per 5 min). Defaults 600 / 120 / 30 / 120 |
| `WORKER_CONCURRENCY` | no | Jobs processed at once per worker. Default 10 |
| `ALLOW_DEV_ACCOUNT_HEADER` | **never in production** | Ignored anyway when `NODE_ENV=production` |

Mobile (EAS environment): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`,
`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`,
`EXPO_PUBLIC_IOS_BUNDLE_ID`, `EXPO_PUBLIC_ANDROID_PACKAGE`, `EXPO_PUBLIC_SENTRY_DSN`.
Do **not** set `EXPO_PUBLIC_DEV_ACCOUNT_ID` for production builds.

## Sign-in setup

- **Google:** in Google Cloud Console create OAuth clients for iOS, Android
  (with your signing SHA-1) and Web. The app uses the Web client id to get an
  ID token; put all three ids in `GOOGLE_CLIENT_IDS`.
- **Apple:** enable *Sign in with Apple* on the App ID. The app already
  declares the capability (`mobile/app.config.ts`). Put the bundle id in
  `APPLE_AUDIENCES`.
- Both need a development or store build. Expo Go cannot do native sign-in.

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
