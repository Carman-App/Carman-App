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

    /** 32-byte key (base64) for encrypting sensitive fields such as ID numbers. */
    DATA_ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "DATA_ENCRYPTION_KEY must be 32 bytes, base64 encoded"),
    /** Shared with the web server only; signs short-lived WhatsApp Status poster links. */
    POSTER_SIGNING_SECRET: z.string().min(32),
    PUBLIC_API_URL: z.url().default("http://localhost:4000"),

    MEDIA_PROVIDER: z.enum(["cloudinary", "disabled"]).default("disabled"),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    PAYMENTS_PROVIDER: z.enum(["mpesa", "disabled"]).default("disabled"),
    MPESA_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
    MPESA_CONSUMER_KEY: z.string().optional(),
    MPESA_CONSUMER_SECRET: z.string().optional(),
    MPESA_SHORTCODE: z.string().optional(),
    MPESA_PASSKEY: z.string().optional(),
    /** Public HTTPS URL Safaricom calls; the API appends ?token=MPESA_CALLBACK_TOKEN. */
    MPESA_CALLBACK_URL: z.url().optional(),
    MPESA_CALLBACK_TOKEN: z.string().min(24).optional(),
    /** Optional comma-separated list of IPs allowed to call the callback (Safaricom's published ranges). */
    MPESA_CALLBACK_IPS: csv,
    /** Confirm every success callback with an STK Query before activating anything. */
    MPESA_VERIFY_WITH_QUERY: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),

    PUSH_PROVIDER: z.enum(["expo", "disabled"]).default("disabled"),
    EXPO_ACCESS_TOKEN: z.string().optional(),

    JOBS_ENABLED: z
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
    if (env.MEDIA_PROVIDER === "cloudinary") {
      for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when MEDIA_PROVIDER=cloudinary" });
      }
    }
    if (env.PAYMENTS_PROVIDER === "mpesa") {
      for (const key of ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE", "MPESA_PASSKEY", "MPESA_CALLBACK_URL", "MPESA_CALLBACK_TOKEN"] as const) {
        if (!env[key]) ctx.addIssue({ code: "custom", path: [key], message: "Required when PAYMENTS_PROVIDER=mpesa" });
      }
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
