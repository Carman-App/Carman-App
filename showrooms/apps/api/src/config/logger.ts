import pino from "pino";
import { env, isProduction } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "showrooms-api", env: env.APP_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
      "*.refreshToken",
      "*.token",
    ],
    censor: "[redacted]",
  },
  transport: !isProduction && env.NODE_ENV !== "test" ? { target: "pino-pretty", options: { colorize: true } } : undefined,
});
