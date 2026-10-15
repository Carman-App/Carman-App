import { Router } from "express";
import { z } from "zod";
import { adminUsersQuerySchema, objectIdSchema, updateUserStatusSchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, authorize, requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import { requestMeta } from "../audit/audit.service";
import * as adminUsers from "./admin-users.service";

const idParams = z.object({ id: objectIdSchema });

export function adminRoutes(): Router {
  const router = Router();
  // Every admin route is gated here, server-side, regardless of what the UI shows.
  router.use(authenticate, authorize("ADMIN"));

  router.get(
    "/users",
    handler({ query: adminUsersQuerySchema }, async ({ res, query }) => {
      const { items, meta } = await adminUsers.listUsers(query);
      ok(res, items, meta);
    }),
  );
  router.patch(
    "/users/:id/status",
    handler({ params: idParams, body: updateUserStatusSchema }, async ({ req, res, params, body }) => {
      ok(res, await adminUsers.updateUserStatus(requireAuth(req), params.id, body, requestMeta(req)));
    }),
  );
  return router;
}

const tag = "Admin";
describeRoute({ method: "get", path: "/admin/users", tag, summary: "List and search users", auth: true, query: adminUsersQuerySchema, responses: { 200: "Users", 403: "Admins only" } });
describeRoute({ method: "patch", path: "/admin/users/:id/status", tag, summary: "Suspend, reactivate or deactivate a user", auth: true, body: updateUserStatusSchema, responses: { 200: "Updated", 403: "Admins only" } });
