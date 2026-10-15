# Deployment

## Environments

`APP_ENV` = `development` | `staging` | `production`, with `NODE_ENV=production`
for both deployed stages. The API validates its environment at boot and
refuses to start in staging/production without `CORS_ORIGINS`, with fewer than
10 bcrypt rounds, or with `MEDIA_PROVIDER=local`. Swagger is off in production.

Recommended layout (Kenya traffic): web on Vercel or a container host, API in
containers behind a load balancer, MongoDB Atlas (replica set) in a nearby
region (`eu-west`/`af-south-1`), Cloudinary for media.

| Host | Serves |
| ---- | ------ |
| `showrooms.co.ke` | Next.js |
| `api.showrooms.co.ke` | Express API (same site, so the auth cookie stays first-party) |

## API

```bash
docker build -f infrastructure/docker/api.Dockerfile -t showrooms-api .
docker run --env-file api.env -p 4000:4000 showrooms-api
```

Without Docker: `pnpm --filter @showrooms/api build && pnpm --filter @showrooms/api deploy --prod --legacy out && cp -r apps/api/dist out/ && node out/dist/server.js`.

Per release: `pnpm --filter @showrooms/api sync-indexes` (indexes are not
built on boot in production). First deploy: `create-admin`.

Settings to get right:
- `TRUST_PROXY` = number of proxies in front (1 behind one load balancer) so
  rate limits and audit logs see client IPs.
- `JOBS_ENABLED=true` on exactly one instance.
- `MPESA_CALLBACK_URL` must be public HTTPS; set `MPESA_CALLBACK_TOKEN`, and
  `MPESA_CALLBACK_IPS` to Safaricom's published ranges if your proxy preserves IPs.
  Start with `MPESA_ENV=sandbox` and the sandbox shortcode/passkey.
- `MEDIA_PROVIDER=cloudinary` with the three Cloudinary values.
- `EMAIL_PROVIDER=resend` with a verified sending domain.
- `PUSH_PROVIDER=expo` (+ `EXPO_ACCESS_TOKEN` if push security is enabled).
- Several API instances: move rate limits to Redis first.

## Web

```bash
docker build -f infrastructure/docker/web.Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.showrooms.co.ke/api/v1 \
  --build-arg NEXT_PUBLIC_SITE_URL=https://showrooms.co.ke -t showrooms-web .
docker run -e POSTER_SIGNING_SECRET=… -e API_INTERNAL_URL=http://api:4000/api/v1 -p 3000:3000 showrooms-web
```

On Vercel: root directory `showrooms/apps/web`, install `pnpm install`, build
`pnpm --filter @showrooms/web build`, env `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_SITE_URL`, `POSTER_SIGNING_SECRET` (server only).

## Whole stack on one machine

```bash
cp infrastructure/docker/stack.env.example infrastructure/docker/stack.env   # fill secrets
POSTER_SIGNING_SECRET=… docker compose -f infrastructure/docker/docker-compose.full.yml up --build
```

## Mobile

See [mobile.md](mobile.md).

## CI

`.github/workflows/showrooms-ci.yml` runs lint, typecheck, all unit and
integration tests, the web production build and an Android bundle on every
PR, then Playwright journeys against a real API, web build and MongoDB.
