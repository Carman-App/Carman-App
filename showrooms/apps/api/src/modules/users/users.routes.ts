import { Router } from "express";
import { updateProfileSchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import { getCurrentUser } from "../auth/auth.service";
import * as usersService from "./users.service";

export function usersRoutes(): Router {
  const router = Router();
  router.use(authenticate);
  router.get("/me", handler({}, async ({ req, res }) => ok(res, await getCurrentUser(requireAuth(req).userId))));
  router.patch(
    "/me",
    handler({ body: updateProfileSchema }, async ({ req, res, body }) => ok(res, await usersService.updateProfile(requireAuth(req).userId, body))),
  );
  return router;
}

describeRoute({ method: "get", path: "/users/me", tag: "Users", summary: "Current user's profile", auth: true });
describeRoute({ method: "patch", path: "/users/me", tag: "Users", summary: "Update name or phone", auth: true, body: updateProfileSchema, responses: { 200: "Updated", 409: "Phone already used" } });
