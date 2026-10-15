import { randomUUID } from "node:crypto";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Router, type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { isDatabaseReady } from "./config/database";
import { logger } from "./config/logger";
import { buildOpenApiSpec } from "./docs/openapi";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { createRateLimiters } from "./middleware/rate-limit";
import { noStore } from "./middleware/cache";
import { services } from "./services";
import { LocalMediaService } from "./services/media/local.media";
import { adminRoutes } from "./modules/admin/admin.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { boostsRoutes, vehicleBoostRoutes } from "./modules/boosts/boosts.routes";
import { categoriesRoutes } from "./modules/categories/categories.routes";
import { dealerStaffRoutes } from "./modules/dealers/staff.routes";
import { favoritesRoutes } from "./modules/favorites/favorites.routes";
import { buyerInquiryRoutes, sellerInquiryRoutes, vehicleInquiryRoutes } from "./modules/inquiries/inquiries.routes";
import { notificationsRoutes } from "./modules/notifications/notifications.routes";
import { paymentsRoutes } from "./modules/payments/payments.routes";
import { vehicleReportRoutes } from "./modules/reports/reports.routes";
import { brokersRoutes, dealersRoutes, followsRoutes } from "./modules/sellers/showrooms.routes";
import { subscriptionsRoutes } from "./modules/subscriptions/subscriptions.routes";
import { uploadsRoutes } from "./modules/uploads/uploads.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { vehiclesRoutes } from "./modules/vehicles/vehicles.routes";

export interface AppOptions {
  rateLimit?: boolean;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const limits = createRateLimiters(options.rateLimit ?? env.RATE_LIMIT_ENABLED);

  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = typeof incoming === "string" && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      autoLogging: env.NODE_ENV !== "test",
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      // Requests without an Origin (native apps, server-to-server, M-Pesa callbacks) are not CORS requests.
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Client-Type", "X-Request-Id", "Idempotency-Key"],
      exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy"],
      maxAge: 600,
    }),
  );
  // gzip JSON: listing pages are much smaller over slow mobile connections.
  app.use(compression({ threshold: 1024 }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  const api = Router();
  api.use(limits.general);
  api.use(noStore);
  api.get("/health", (_req, res) => {
    const db = isDatabaseReady();
    res.status(db ? 200 : 503).json({ data: { status: db ? "ok" : "degraded", db: db ? "up" : "down" } });
  });
  api.use("/auth", authRoutes(limits));
  api.use("/users", usersRoutes());
  api.use("/vehicles/:vehicleId/inquiries", vehicleInquiryRoutes());
  api.use("/vehicles/:vehicleId/reports", vehicleReportRoutes());
  api.use("/vehicles/:vehicleId/boost", vehicleBoostRoutes());
  api.use("/vehicles", vehiclesRoutes());
  api.use("/brokers", brokersRoutes());
  api.use("/dealers", dealersRoutes(dealerStaffRoutes()));
  api.use("/follows", followsRoutes());
  api.use("/broker", sellerInquiryRoutes());
  api.use("/inquiries", buyerInquiryRoutes());
  api.use("/favorites", favoritesRoutes());
  api.use("/uploads", uploadsRoutes());
  api.use("/categories", categoriesRoutes());
  api.use("/notifications", notificationsRoutes());
  api.use("/analytics", analyticsRoutes());
  api.use("/subscriptions", subscriptionsRoutes());
  api.use("/payments", paymentsRoutes());
  api.use("/boosts", boostsRoutes());
  api.use("/admin", adminRoutes());
  app.use("/api/v1", api);

  // Development-only local media storage (MEDIA_PROVIDER=local).
  const media = services().media;
  if (media instanceof LocalMediaService) app.use(limits.general, media.router());

  if (env.APP_ENV !== "production") {
    const spec = buildOpenApiSpec();
    app.get("/api/docs.json", (_req, res) => res.json(spec));
    // Swagger UI needs inline scripts and styles, so relax CSP for the docs page only.
    app.use("/api/docs", helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(spec));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
