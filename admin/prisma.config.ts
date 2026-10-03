import "./load-env";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations need a direct (unpooled) connection: DIRECT_DATABASE_URL when
    // DATABASE_URL goes through a pooler (Supabase port 6543, PgBouncer).
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
});
