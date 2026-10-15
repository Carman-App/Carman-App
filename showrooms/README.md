# Showrooms — Kenyan Vehicle Marketplace

**Give Kenyan vehicle brokers a bigger showroom without replacing WhatsApp.**

Brokers, dealers and independent sellers list vehicles once, reach buyers far
beyond their own WhatsApp contacts, and share every listing back to WhatsApp
chats, groups and Status. Buyers search, save, compare and contact sellers
directly on WhatsApp or by phone.

```
                       Expo mobile (Android/iOS)        Next.js web
                        buyer + seller apps     public site · dashboards · /admin
                                   \                    /
                                    Express API  /api/v1
                         MongoDB · Cloudinary · M-Pesa Daraja · Resend · Expo Push
```

| Folder | What | Stack |
| ------ | ---- | ----- |
| `apps/api` | REST API, the only place business rules and authorization live | Express 5, Mongoose 9, Zod 4, Pino, JWT + rotating refresh tokens |
| `apps/web` | SEO marketplace, user dashboard, admin dashboard | Next.js 16 App Router, Tailwind 4, shadcn-style UI, TanStack Query, RHF, Recharts |
| `apps/mobile` | Buyer and seller app | Expo SDK 57, Expo Router, NativeWind, TanStack Query, RHF, SecureStore |
| `packages/shared` | Zod schemas, types, constants, design tokens, share-message builder | Isomorphic TypeScript |
| `infrastructure/docker` | Local MongoDB, Dockerfiles, full-stack compose | |
| `docs/` | [architecture](docs/architecture.md), [API](docs/api.md), [security](docs/security.md), [deployment](docs/deployment.md), [mobile](docs/mobile.md) | |

## Quick start

Requirements: Node.js 22.12+, pnpm 10 (`corepack enable`), Docker (for MongoDB) or any MongoDB 7+ replica set.

```bash
pnpm install
pnpm db:up                                  # MongoDB 8 replica set on :27017

cp apps/api/.env.example apps/api/.env      # set JWT_ACCESS_SECRET, DATA_ENCRYPTION_KEY, POSTER_SIGNING_SECRET
cp apps/web/.env.example apps/web/.env.local  # same POSTER_SIGNING_SECRET
pnpm seed                                   # plans, makes, 9 demo accounts, 48 vehicles
pnpm dev:api                                # http://localhost:4000/api/v1  (Swagger: /api/docs)
pnpm --filter @showrooms/web dev            # http://localhost:3000
pnpm --filter @showrooms/mobile dev         # Expo; press "a" for Android
```

`MEDIA_PROVIDER=local` (the default in `apps/api/.env.example`) stores uploads
on disk so photo uploads work without Cloudinary credentials. Payments are
off until you add Daraja sandbox credentials (`PAYMENTS_PROVIDER=mpesa`).

### Demo accounts (password `Showroom2026`)

| Role | Email | Notes |
| ---- | ----- | ----- |
| Admin | admin@showrooms.test | `/admin` |
| Buyer | buyer@showrooms.test | |
| Broker | broker@showrooms.test | Otieno Motors, Nairobi, Pro plan |
| Broker | kamau@showrooms.test | Kamau Car Deals, Nakuru, Pro plan |
| Dealer | dealer@showrooms.test | Coast Auto Dealers, Mombasa, Dealer plan |

Real administrators are created only from the command line:
`ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm --filter @showrooms/api create-admin`.

## Scripts (from this folder)

| Command | |
| ------- | - |
| `pnpm dev` | All apps in watch mode |
| `pnpm build` | Production builds (API bundle, Next.js) |
| `pnpm lint` / `pnpm typecheck` | Every package |
| `pnpm test` | Shared + API integration + web unit + mobile Jest |
| `pnpm --filter @showrooms/web test:e2e` | Playwright journeys against running API + web |
| `pnpm --filter @showrooms/mobile export:android` | Bundle the Android app (Hermes) |
| `pnpm seed` | Demo data (refuses to run in production) |
| `pnpm --filter @showrooms/api sync-indexes` | Build MongoDB indexes (run per release) |
| `pnpm db:up` / `pnpm db:down` | Local MongoDB |

## Tests

| Suite | Count | Covers |
| ----- | ----- | ------ |
| `packages/shared` (Vitest) | 23 | phone normalisation, schemas, KES formatting, WhatsApp message, query strings |
| `apps/api` (Vitest + supertest + in-memory MongoDB replica set) | 66 | all 13 journeys end to end, auth + refresh rotation/reuse, role and ownership checks, dealer staff scoping, moderation, duplicates, reports, verification privacy, reviews, plan limits, M-Pesa callbacks (bad token, duplicate/concurrent, amount mismatch, unverified, cancelled, retry), subscriptions, expiry jobs |
| `apps/web` (Vitest) | 3 | open-redirect guard, poster signature, error mapping |
| `apps/web` (Playwright, Pixel 7 + desktop) | 5 | buyer: register → search → details → WhatsApp → save → viewing; broker: register → upload photos → submit; admin approves; listing public; share; admin gate |
| `apps/mobile` (Jest + RNTL) | 15 | SecureStore session, single-flight refresh rotation, offline behaviour, filters ↔ API keys, WhatsApp share, wizard validation, login screen |

API tests download `mongod` on first run; offline, set
`MONGOMS_SYSTEM_BINARY=/path/to/mongod MONGOMS_VERSION=8.0.23`.

## What "verified" means

*Verified seller*: identity (and business documents for dealers) checked by
our team. *Verified listing*: staff reviewed the listing's details. Neither
guarantees a vehicle's condition, ownership or authenticity. Every listing
shows: **Always inspect and verify a vehicle before making payment.**
