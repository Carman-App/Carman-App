import { Router } from "express";
import { z } from "zod";
import { objectIdSchema, paginationQuerySchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import { paginate } from "../../utils/slug";
import { Notification, PushToken } from "./notification.model";

const pushTokenSchema = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/, "Not an Expo push token"),
  platform: z.enum(["android", "ios", "web"]),
});

export function notificationsRoutes(): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    "/",
    handler({ query: paginationQuerySchema }, async ({ req, res, query }) => {
      const userId = requireAuth(req).userId;
      const [items, total, unread] = await Promise.all([
        Notification.find({ userId }).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
        Notification.countDocuments({ userId }),
        Notification.countDocuments({ userId, readAt: null }),
      ]);
      ok(res, items.map((n) => n.toJSON()), { ...paginate(query.page, query.limit, total), unread });
    }),
  );

  router.get("/unread-count", handler({}, async ({ req, res }) => ok(res, { unread: await Notification.countDocuments({ userId: requireAuth(req).userId, readAt: null }) })));

  router.patch(
    "/:id/read",
    handler({ params: z.object({ id: objectIdSchema }) }, async ({ req, res, params }) => {
      await Notification.updateOne({ _id: params.id, userId: requireAuth(req).userId, readAt: null }, { readAt: new Date() });
      ok(res, { read: true });
    }),
  );

  router.post(
    "/read-all",
    handler({}, async ({ req, res }) => {
      const result = await Notification.updateMany({ userId: requireAuth(req).userId, readAt: null }, { readAt: new Date() });
      ok(res, { updated: result.modifiedCount });
    }),
  );

  router.post(
    "/push-tokens",
    handler({ body: pushTokenSchema }, async ({ req, res, body }) => {
      // A device token belongs to whoever signed in on it most recently.
      await PushToken.updateOne({ token: body.token }, { $set: { userId: requireAuth(req).userId, platform: body.platform } }, { upsert: true });
      ok(res, { registered: true }, undefined, 201);
    }),
  );

  router.delete(
    "/push-tokens",
    handler({ body: pushTokenSchema.pick({ token: true }) }, async ({ req, res, body }) => {
      await PushToken.deleteOne({ token: body.token, userId: requireAuth(req).userId });
      ok(res, { registered: false });
    }),
  );
  return router;
}

const tag = "Notifications";
describeRoute({ method: "get", path: "/notifications", tag, summary: "My notifications (meta.unread)", auth: true, query: paginationQuerySchema });
describeRoute({ method: "get", path: "/notifications/unread-count", tag, summary: "Unread count", auth: true });
describeRoute({ method: "patch", path: "/notifications/:id/read", tag, summary: "Mark one read", auth: true });
describeRoute({ method: "post", path: "/notifications/read-all", tag, summary: "Mark all read", auth: true });
describeRoute({ method: "post", path: "/notifications/push-tokens", tag, summary: "Register this device's Expo push token", auth: true, body: pushTokenSchema });
describeRoute({ method: "delete", path: "/notifications/push-tokens", tag, summary: "Unregister a push token (sign out)", auth: true });
