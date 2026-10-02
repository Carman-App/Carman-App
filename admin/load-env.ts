/**
 * Loads env files exactly the way `next dev` / `next start` do (.env.$(NODE_ENV).local,
 * .env.local, .env.$(NODE_ENV), .env — first one wins), so Prisma commands,
 * seeds, scripts and the worker see the same settings as the server.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
