import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { addDealerStaffSchema, DEALER_STAFF_ROLES, objectIdSchema } from "@showrooms/shared";
import { env } from "../../config/env";
import { describeRoute } from "../../docs/openapi";
import { requireAuth } from "../../middleware/auth";
import { services } from "../../services";
import { AppError } from "../../utils/app-error";
import { created, handler, ok } from "../../utils/handler";
import { generateOpaqueToken, hashToken } from "../../utils/tokens";
import { audit, requestMeta } from "../audit/audit.service";
import { hashPassword } from "../auth/password";
import { PasswordResetToken } from "../auth/password-reset-token.model";
import { RefreshToken } from "../auth/refresh-token.model";
import { getSellerContext, requireDealerOwner, type SellerContext } from "../sellers/seller-context";
import { getEntitlements } from "../subscriptions/entitlements.service";
import { User } from "../users/user.model";

async function ownerContext(req: Request): Promise<SellerContext> {
  const ctx = await getSellerContext(requireAuth(req));
  requireDealerOwner(ctx);
  return ctx;
}

async function listStaff(ctx: SellerContext) {
  const users = await User.find({ _id: { $in: ctx.dealer!.staff.map((s) => s.userId) } }).select("name email phone status").lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return ctx.dealer!.staff.map((s) => {
    const u = byId.get(String(s.userId));
    return { userId: String(s.userId), name: u?.name, email: u?.email, phone: u?.phone, status: u?.status, staffRole: s.staffRole, addedAt: s.addedAt?.toISOString() };
  });
}

/**
 * Dealer staff: separate logins that act for one dealership. Staff can manage
 * inventory and leads; only the owner manages staff, billing and the profile.
 */
export function dealerStaffRoutes(): Router {
  const router = Router();

  router.get("/", handler({}, async ({ req, res }) => ok(res, await listStaff(await ownerContext(req)))));

  router.post(
    "/",
    handler({ body: addDealerStaffSchema }, async ({ req, res, body }) => {
      const ctx = await ownerContext(req);
      const ent = await getEntitlements(ctx);
      if (!ent.features.staffAccounts) throw AppError.forbidden("Staff accounts are part of the Dealer plan");
      if (ctx.dealer!.staff.length >= ent.staffLimit) throw AppError.forbidden(`Your plan allows ${ent.staffLimit} staff accounts`);
      if (await User.exists({ email: body.email })) throw AppError.conflict("That email already has a Showrooms account", "EMAIL_TAKEN");
      if (body.phone && (await User.exists({ phone: body.phone }))) throw AppError.conflict("That phone number already has a Showrooms account", "PHONE_TAKEN");

      // Random unusable password; the staff member sets their own through the emailed link.
      const user = await User.create({ name: body.name, email: body.email, phone: body.phone, role: "DEALER", passwordHash: await hashPassword(randomBytes(32).toString("hex")) });
      ctx.dealer!.staff.push({ userId: user._id, staffRole: body.staffRole, addedAt: new Date() });
      await ctx.dealer!.save();

      const token = generateOpaqueToken(32);
      await PasswordResetToken.create({ userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 72 * 3600_000) });
      const link = `${env.WEB_URL}/reset-password?token=${encodeURIComponent(token)}&welcome=1`;
      await services()
        .email.send({
          to: user.email,
          subject: `You've been added to ${ctx.dealer!.businessName} on Showrooms`,
          text: `Hi ${user.name},\n\n${ctx.dealer!.businessName} added you as staff on Showrooms. Set your password here (valid for 72 hours):\n\n${link}`,
          html: `<p>Hi ${user.name},</p><p>${ctx.dealer!.businessName} added you as staff on Showrooms.</p><p><a href="${link}">Set your password</a> (valid for 72 hours).</p>`,
        })
        .catch(() => undefined);

      await audit({ action: "dealer.staff_added", actorId: ctx.userId, actorRole: "DEALER", entityType: "User", entityId: String(user._id), metadata: { dealerId: String(ctx.dealer!._id), staffRole: body.staffRole } }, requestMeta(req));
      created(res, await listStaff(ctx));
    }),
  );

  router.patch(
    "/:userId",
    handler({ params: z.object({ userId: objectIdSchema }), body: z.object({ staffRole: z.enum(DEALER_STAFF_ROLES) }) }, async ({ req, res, params, body }) => {
      const ctx = await ownerContext(req);
      const member = ctx.dealer!.staff.find((s) => String(s.userId) === params.userId);
      if (!member) throw AppError.notFound("Staff member");
      member.staffRole = body.staffRole;
      await ctx.dealer!.save();
      ok(res, await listStaff(ctx));
    }),
  );

  router.delete(
    "/:userId",
    handler({ params: z.object({ userId: objectIdSchema }) }, async ({ req, res, params }) => {
      const ctx = await ownerContext(req);
      const before = ctx.dealer!.staff.length;
      ctx.dealer!.set("staff", ctx.dealer!.staff.filter((s) => String(s.userId) !== params.userId));
      if (ctx.dealer!.staff.length === before) throw AppError.notFound("Staff member");
      await ctx.dealer!.save();
      // A removed staff login is deactivated so it can't act for the dealership (or start a new one).
      await User.updateOne({ _id: params.userId }, { status: "DEACTIVATED" });
      await RefreshToken.updateMany({ userId: params.userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: "ADMIN" } });
      await audit({ action: "dealer.staff_removed", actorId: ctx.userId, actorRole: "DEALER", entityType: "User", entityId: params.userId, metadata: { dealerId: String(ctx.dealer!._id) } }, requestMeta(req));
      ok(res, await listStaff(ctx));
    }),
  );

  describeRoute({ method: "get", path: "/dealers/me/staff", tag: "Dealers", summary: "List staff (owner)", auth: true });
  describeRoute({ method: "post", path: "/dealers/me/staff", tag: "Dealers", summary: "Add a staff login; they get an email to set a password", auth: true, body: addDealerStaffSchema });
  describeRoute({ method: "patch", path: "/dealers/me/staff/:userId", tag: "Dealers", summary: "Change a staff member's role", auth: true });
  describeRoute({ method: "delete", path: "/dealers/me/staff/:userId", tag: "Dealers", summary: "Remove and deactivate a staff login", auth: true });
  return router;
}
