# Carma API + admin console, and the background worker, from one Dockerfile.
#   docker build --target web    -t carma-web .
#   docker build --target worker -t carma-worker .
# Migrations run once per deploy with the worker image:
#   docker run --rm --env-file .env carma-worker npx prisma migrate deploy

# Official Node image; override if Docker Hub rate-limits your builder, e.g.
#   --build-arg NODE_IMAGE=public.ecr.aws/docker/library/node:22-slim
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- dependencies (cached until package files change)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- build: Prisma client + Next.js standalone server
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# --- web: the API and console. Minimal image: the standalone server only.
FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r carma && useradd -r -g carma carma
COPY --from=build --chown=carma:carma /app/.next/standalone ./
COPY --from=build --chown=carma:carma /app/.next/static ./.next/static
USER carma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# --- worker: background jobs; also runs migrations and seeds
FROM build AS worker
ENV NODE_ENV=production
RUN groupadd -r carma && useradd -r -g carma carma && chown -R carma:carma /app
USER carma
CMD ["npm", "run", "worker"]
