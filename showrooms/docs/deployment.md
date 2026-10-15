# Deployment

Full instructions arrive in Phase 7. What applies already:

## Environments

`APP_ENV` is `development`, `staging` or `production`; `NODE_ENV=production` for
both staging and production builds. In staging/production the API refuses to
start without `CORS_ORIGINS` or with fewer than 10 bcrypt rounds, and Swagger UI
is disabled in production.

## API

```bash
pnpm install --frozen-lockfile
pnpm --filter @showrooms/api build    # bundles to apps/api/dist/server.js (shared package included)
node --env-file=.env apps/api/dist/server.js
```

- Use a managed MongoDB replica set (e.g. MongoDB Atlas, region close to Kenya such as `eu-west`/`af-south-1`).
- `autoIndex` is off when `APP_ENV=production`; build indexes once per release
  (a `sync-indexes` script comes with Phase 2).
- Set `TRUST_PROXY` to the number of proxies in front of the API so rate limits see client IPs.
- Serve web and API under one parent domain (e.g. `showrooms.co.ke` and
  `api.showrooms.co.ke`) and set `COOKIE_DOMAIN` only if the web app must read the cookie on the server.
- Run more than one instance only after moving rate limits to a shared store.
- Create the first admin with `pnpm --filter @showrooms/api create-admin`.
