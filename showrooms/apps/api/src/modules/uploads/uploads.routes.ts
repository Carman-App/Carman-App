import { Router } from "express";
import { uploadCompleteSchema, uploadSignatureSchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import * as uploads from "./uploads.service";

export function uploadsRoutes(): Router {
  const router = Router();
  router.use(authenticate);
  router.post("/signature", handler({ body: uploadSignatureSchema }, async ({ req, res, body }) => ok(res, await uploads.createSignature(requireAuth(req), body))));
  router.post("/complete", handler({ body: uploadCompleteSchema }, async ({ req, res, body }) => ok(res, await uploads.completeUpload(requireAuth(req), body))));
  return router;
}

describeRoute({
  method: "post",
  path: "/uploads/signature",
  tag: "Uploads",
  summary: "Signed parameters for a direct upload to Cloudinary (checks type, size and listing ownership)",
  auth: true,
  body: uploadSignatureSchema,
});
describeRoute({ method: "post", path: "/uploads/complete", tag: "Uploads", summary: "Confirm an upload and attach it to the listing/profile", auth: true, body: uploadCompleteSchema });
