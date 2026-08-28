# Carma Admin

Internal ops dashboard + the API backend the mobile app will consume, built
on Next.js 16 (App Router, `src/`, Turbopack). See `AGENTS.md` before writing
code — this Next.js version has breaking changes vs. older training data
(`middleware.ts` is now `src/proxy.ts`, for example).

## Connect a real Postgres database

1. Get a Postgres connection string — [Neon](https://neon.tech), Supabase,
   Railway, RDS, or a local Postgres all work.
2. Put it in `.env` as `DATABASE_URL` (replace the placeholder that's there
   now — see `.env.example` for the full list of variables).
3. Generate a session secret and set it as `SESSION_SECRET` in `.env`:
   ```bash
   openssl rand -base64 32
   ```
4. Apply the schema to your database:
   ```bash
   npx prisma migrate dev --name init
   ```
5. (Optional) Object storage for documents/reports — `S3_BUCKET`,
   `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` in `.env` (see
   `src/lib/storage.ts`). Not required for the app to build or run.

## Create your first admin login

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then:

```bash
npm run create-admin
```

This upserts an `AdminUser` row (bcrypt-hashed password) via
`scripts/create-admin.ts`. Re-running it with a new `ADMIN_PASSWORD` resets
that admin's password. Sign in at `/login`.

## Develop

```bash
npm run dev
```

Everything under `/` other than `/login` and `/api/*` requires a signed-in
admin session (`src/proxy.ts` redirects to `/login`; `src/app/(dashboard)/layout.tsx`
re-checks server-side).

## Verify

```bash
npx prisma validate && npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

The build does not require a live database — every page that queries
Postgres is marked `export const dynamic = "force-dynamic"` so those
queries run at request time, not build time.

## Layout

- `prisma/schema.prisma` — full data model (Owner + Workshop sides).
- `prisma.config.ts` — Prisma 7 config (driver adapter, migrations path).
- `src/lib/prisma.ts` — Prisma Client singleton (via `@prisma/adapter-pg`).
- `src/lib/auth/` — admin session (`session.ts`, hand-rolled signed cookie),
  password hashing (`password.ts`), and a not-yet-wired-up end-user
  OAuth abstraction (`provider.ts`) for a later phase.
- `src/lib/api/` — `/api/v1/*` auth (`auth.ts`), resource authorization
  (`authorize.ts`), zod schemas (`schemas.ts`), response shape (`response.ts`).
- `src/lib/jobs/state-machine.ts` — the Job status transition graph.
- `src/lib/limits.ts` — plan-limit checks, computed from live rows.
- `src/lib/storage.ts` — S3-compatible object storage abstraction.
- `src/lib/notifications/provider.ts` — notification abstraction (no-op
  provider today; persists to `Notification` regardless).
- `src/app/(dashboard)/` — the admin dashboard shell + sections.
- `src/app/login/` — admin login page + server action.
- `src/app/api/v1/` — representative mobile-facing REST routes.
- `src/proxy.ts` — Next.js 16 Proxy (formerly Middleware); guards the dashboard.
