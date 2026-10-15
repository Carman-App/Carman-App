# Showrooms — Kenyan Vehicle Marketplace

Digital showrooms for Kenyan vehicle brokers, dealers and independent sellers.
Brokers list vehicles once, reach buyers beyond their own WhatsApp contacts,
and share every listing back to WhatsApp.

```
apps/api          Express + MongoDB REST API (/api/v1)     ← Phase 1 (done)
apps/web          Next.js: public site, dashboards, /admin ← Phase 2+
apps/mobile       Expo + React Native (Android first)      ← Phase 3+
packages/shared   Zod schemas, types, constants, design tokens
infrastructure/   Docker for local MongoDB
docs/             architecture.md, api.md, deployment.md
```

## Requirements

- Node.js 22.12+
- pnpm 10 (`corepack enable`)
- Docker (for local MongoDB), or any MongoDB 7+ replica set

## Getting started

```bash
pnpm install
pnpm db:up                               # MongoDB 8 single-node replica set on :27017
cp apps/api/.env.example apps/api/.env   # then set JWT_ACCESS_SECRET (openssl rand -base64 48)
pnpm seed                                # demo accounts, password Showroom2026
pnpm dev:api                             # http://localhost:4000/api/v1
```

API docs (Swagger UI): http://localhost:4000/api/docs · OpenAPI JSON: `/api/docs.json`
(not served when `APP_ENV=production`).

Demo accounts after `pnpm seed`:

| Role   | Email                   |
| ------ | ----------------------- |
| Admin  | admin@showrooms.test    |
| Buyer  | buyer@showrooms.test    |
| Broker | broker@showrooms.test   |
| Dealer | dealer@showrooms.test   |

Create a real administrator (the public API can never create one):

```bash
ADMIN_EMAIL=ops@example.com ADMIN_PASSWORD='...' pnpm --filter @showrooms/api create-admin
```

## Scripts (run from this folder)

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Every app in watch mode                       |
| `pnpm dev:api`   | API only                                      |
| `pnpm build`     | Production builds                             |
| `pnpm typecheck` | `tsc` in every package                        |
| `pnpm lint`      | ESLint in every package                       |
| `pnpm test`      | Unit + integration tests                      |
| `pnpm db:up/down`| Start/stop local MongoDB                      |
| `pnpm seed`      | Demo data (refuses to run in production)      |

API tests start an in-memory MongoDB replica set with `mongodb-memory-server`,
which downloads `mongod` on first run. Offline, point it at a local binary:
`MONGOMS_SYSTEM_BINARY=/path/to/mongod MONGOMS_VERSION=8.0.23 pnpm test`.

## Environment variables

Every variable is documented in [`.env.example`](.env.example). The API
validates its environment at startup and refuses to boot on missing or weak
values. Secrets never use `NEXT_PUBLIC_` / `EXPO_PUBLIC_` prefixes.

## Build phases

1. **Monorepo, auth, roles, shared schemas** — done
2. Vehicles, listing APIs, uploads, public website, search
3. Expo buyer experience, broker onboarding, listing, WhatsApp sharing
4. Web dashboards, mobile broker dashboard, inquiries, analytics
5. Admin dashboard, moderation, verification, reports
6. M-Pesa, subscriptions, boosts, notifications
7. Testing, security review, performance, deployment

See [docs/architecture.md](docs/architecture.md) and [docs/api.md](docs/api.md).
