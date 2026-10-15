# Vehicle Marketplace (Showrooms)

Digital showrooms for Kenyan vehicle brokers, dealers and independent sellers.

## Layout

```
apps/mobile   Expo + React Native (Android first, iOS)
apps/web      Next.js: public site, user dashboard, /admin
apps/api      Express + MongoDB REST API (/api/v1)
packages/shared  Zod schemas, types, constants shared across apps
infrastructure/docker  Local MongoDB
docs/         architecture, API, deployment
```

Package manager: pnpm workspaces (`pnpm install` from this folder).

Status: folder structure only. Apps are built phase by phase (see the project brief).
