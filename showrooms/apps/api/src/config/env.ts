import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Deployment stage, separate from NODE_ENV so staging can run production builds. */
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    /** Number of proxy hops to trust for req.ip (load balancer, Cloudflare...). */
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    MONGODB_URI: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    CORS_ORIGINS: csv,
    /** Public web URL, used in emails (password reset links, listing links). */
    WEB_URL: z.url().default("http://localhost:3000"),
    COOKIE_DOMAIN: z.string().optional(),

    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),

    EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Showrooms <no-reply@showrooms.co.ke>"),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Required when EMAIL_PROVIDER=resend" });
    }
    if (env.APP_ENV === "production" || env.APP_ENV === "staging") {
      if (env.CORS_ORIGINS.length === 0) {
        ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "Set the allowed web origins" });
      }
      if (env.BCRYPT_ROUNDS < 10) {
        ctx.addIssue({ code: "custom", path: ["BCRYPT_ROUNDS"], message: "Use at least 10 rounds outside development" });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
