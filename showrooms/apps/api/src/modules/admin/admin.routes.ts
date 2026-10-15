import { Router } from "express";
import { z } from "zod";
import {
  adminUsersQuerySchema,
  adminVehiclesQuerySchema,
  analyticsRangeSchema,
  auditLogsQuerySchema,
  categorySchema,
  featureVehicleSchema,
  moderateVehicleSchema,
  objectIdSchema,
  paginationQuerySchema,
  paymentsQuerySchema,
  planSchema,
  platformSettingsSchema,
  profileListQuerySchema,
  reportsQuerySchema,
  resolveReportSchema,
  slugify,
  SUBSCRIPTION_STATUSES,
  updateCategorySchema,
  updatePlanSchema,
  updateUserStatusSchema,
  verificationDecisionSchema,
  verificationsQuerySchema,
  verifyVehicleSchema,
  VERIFICATION_STATUSES,
} from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, authorize, requireAuth } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { created, handler, ok } from "../../utils/handler";
import { escapeRegex, paginate } from "../../utils/slug";
import { adminOverview } from "../analytics/analytics.service";
import { AuditLog } from "../audit/audit-log.model";
import { audit, requestMeta } from "../audit/audit.service";
import { BrokerProfile } from "../brokers/broker-profile.model";
import { Category } from "../categories/category.model";
import { clearCategoryCountsCache } from "../categories/categories.routes";
import { DealerProfile } from "../dealers/dealer-profile.model";
import { Payment } from "../payments/payment.model";
import { reconcilePayment } from "../payments/payments.service";
import { Review } from "../reviews/review.model";
import { recomputeRating } from "../reviews/reviews.service";
import { getSettings, updateSettings } from "../settings/settings.service";
import { Subscription, SubscriptionPlan } from "../subscriptions/subscription.model";
import { User } from "../users/user.model";
import { Vehicle } from "../vehicles/vehicle.model";
import * as adminUsers from "./admin-users.service";
import * as adminVehicles from "./admin-vehicles.service";
import * as trust from "./admin-trust.service";

const idParams = z.object({ id: objectIdSchema });
const profileQuery = profileListQuerySchema.extend({ verificationStatus: z.enum(VERIFICATION_STATUSES).optional() });

export function adminRoutes(): Router {
  const router = Router();
  // Every admin route is gated here, server-side, regardless of what the UI shows.
  router.use(authenticate, authorize("ADMIN"));

  router.get("/overview", handler({ query: analyticsRangeSchema }, async ({ res, query }) => ok(res, await adminOverview(query.days))));

  router.get(
    "/analytics",
    handler({ query: analyticsRangeSchema }, async ({ res, query }) => {
      const [overview, topMakes, topTowns, byStatus] = await Promise.all([
        adminOverview(query.days),
        Vehicle.aggregate([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$make", listings: { $sum: 1 }, views: { $sum: "$viewCount" } } }, { $sort: { listings: -1 } }, { $limit: 10 }]),
        Vehicle.aggregate([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$location.town", listings: { $sum: 1 } } }, { $sort: { listings: -1 } }, { $limit: 10 }]),
        Vehicle.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      ]);
      ok(res, {
        ...overview,
        topMakes: topMakes.map((m) => ({ make: m._id, listings: m.listings, views: m.views })),
        topTowns: topTowns.map((t) => ({ town: t._id, listings: t.listings })),
        listingsByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      });
    }),
  );

  // ---- Users
  router.get("/users", handler({ query: adminUsersQuerySchema }, async ({ res, query }) => {
    const { items, meta } = await adminUsers.listUsers(query);
    ok(res, items, meta);
  }));
  router.get("/users/:id", handler({ params: idParams }, async ({ res, params }) => {
    const user = await User.findById(params.id);
    if (!user) throw AppError.notFound("User");
    const [broker, dealer, listings] = await Promise.all([
      BrokerProfile.findOne({ userId: user._id }),
      DealerProfile.findOne({ $or: [{ ownerId: user._id }, { "staff.userId": user._id }] }),
      Vehicle.aggregate([{ $match: { sellerId: user._id } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);
    ok(res, { ...user.toJSON(), suspendedReason: user.suspendedReason, broker: broker?.toJSON(), dealer: dealer?.toJSON(), listings: Object.fromEntries(listings.map((l) => [l._id, l.n])) });
  }));
  router.patch("/users/:id/status", handler({ params: idParams, body: updateUserStatusSchema }, async ({ req, res, params, body }) => {
    ok(res, await adminUsers.updateUserStatus(requireAuth(req), params.id, body, requestMeta(req)));
  }));

  // ---- Brokers & dealers
  for (const [path, model, nameField] of [["/brokers", BrokerProfile, "displayName"], ["/dealers", DealerProfile, "businessName"]] as const) {
    router.get(path, handler({ query: profileQuery }, async ({ res, query }) => {
      const filter: Record<string, unknown> = {};
      if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
      if (query.town) filter.town = query.town;
      if (query.q) filter[nameField] = new RegExp(escapeRegex(query.q), "i");
      const m = model as unknown as typeof BrokerProfile;
      const [items, total] = await Promise.all([m.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), m.countDocuments(filter)]);
      ok(res, items.map((i) => i.toJSON()), paginate(query.page, query.limit, total));
    }));
  }

  // ---- Verification
  router.get("/verifications", handler({ query: verificationsQuerySchema }, async ({ res, query }) => {
    const { items, meta } = await trust.listVerifications(query);
    ok(res, items, meta);
  }));
  router.get("/verifications/:id", handler({ params: idParams }, async ({ req, res, params }) => ok(res, await trust.verificationDetail(requireAuth(req), params.id, requestMeta(req)))));
  router.post("/verifications/:id/decision", handler({ params: idParams, body: verificationDecisionSchema }, async ({ req, res, params, body }) => {
    ok(res, await trust.decideVerification(requireAuth(req), params.id, body, requestMeta(req)));
  }));

  // ---- Vehicles & moderation
  router.get("/vehicles", handler({ query: adminVehiclesQuerySchema }, async ({ res, query }) => {
    const { items, meta } = await adminVehicles.listVehicles(query);
    ok(res, items, meta);
  }));
  router.get("/vehicles/:id", handler({ params: idParams }, async ({ res, params }) => ok(res, await adminVehicles.vehicleDetail(params.id))));
  router.post("/vehicles/:id/moderate", handler({ params: idParams, body: moderateVehicleSchema }, async ({ req, res, params, body }) => {
    ok(res, await adminVehicles.moderate(requireAuth(req), params.id, body, requestMeta(req)));
  }));
  router.post("/vehicles/:id/feature", handler({ params: idParams, body: featureVehicleSchema }, async ({ req, res, params, body }) => {
    ok(res, await adminVehicles.feature(requireAuth(req), params.id, body, requestMeta(req)));
  }));
  router.post("/vehicles/:id/verify", handler({ params: idParams, body: verifyVehicleSchema }, async ({ req, res, params, body }) => {
    ok(res, await adminVehicles.setVehicleVerified(requireAuth(req), params.id, body, requestMeta(req)));
  }));

  // ---- Reports & reviews
  router.get("/reports", handler({ query: reportsQuerySchema }, async ({ res, query }) => {
    const { items, meta } = await trust.listReports(query);
    ok(res, items, meta);
  }));
  router.patch("/reports/:id", handler({ params: idParams, body: resolveReportSchema }, async ({ req, res, params, body }) => {
    ok(res, await trust.resolveReport(requireAuth(req), params.id, body, requestMeta(req)));
  }));
  router.patch("/reviews/:id", handler({ params: idParams, body: z.object({ hidden: z.boolean() }) }, async ({ req, res, params, body }) => {
    const review = await Review.findByIdAndUpdate(params.id, { hidden: body.hidden }, { returnDocument: "after" });
    if (!review) throw AppError.notFound("Review");
    await recomputeRating({ type: review.targetType, id: review.targetId });
    await audit({ action: body.hidden ? "review.hidden" : "review.shown", actorId: requireAuth(req).userId, actorRole: "ADMIN", entityType: "Review", entityId: params.id }, requestMeta(req));
    ok(res, review.toJSON());
  }));

  // ---- Payments & subscriptions
  router.get("/payments", handler({ query: paymentsQuerySchema }, async ({ res, query }) => {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.purpose) filter.purpose = query.purpose;
    if (query.userId) filter.userId = query.userId;
    if (query.q) filter.$or = [{ mpesaReceiptNumber: query.q.toUpperCase() }, { checkoutRequestId: query.q }, { phone: new RegExp(escapeRegex(query.q)) }];
    const [items, total, sums] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      Payment.countDocuments(filter),
      Payment.aggregate([{ $match: filter }, { $group: { _id: "$status", amount: { $sum: "$amountKes" }, n: { $sum: 1 } } }]),
    ]);
    const users = await User.find({ _id: { $in: items.map((p) => p.userId) } }).select("name email").lean();
    const uMap = new Map(users.map((u) => [String(u._id), u]));
    ok(
      res,
      items.map((p) => ({ ...p.toJSON(), user: uMap.get(String(p.userId)) && { id: String(p.userId), name: uMap.get(String(p.userId))!.name, email: uMap.get(String(p.userId))!.email }, checkoutRequestId: p.checkoutRequestId, callbackCount: p.callbackCount })),
      { ...paginate(query.page, query.limit, total), totals: Object.fromEntries(sums.map((s) => [s._id, { amountKes: s.amount, count: s.n }])) },
    );
  }));
  router.get("/payments/:id", handler({ params: idParams }, async ({ res, params }) => {
    const p = await Payment.findById(params.id).select("+callbacks");
    if (!p) throw AppError.notFound("Payment");
    ok(res, { ...p.toJSON(), callbacks: p.get("callbacks"), checkoutRequestId: p.checkoutRequestId, merchantRequestId: p.merchantRequestId });
  }));
  router.post("/payments/:id/reconcile", handler({ params: idParams }, async ({ req, res, params }) => ok(res, (await reconcilePayment(params.id, requireAuth(req).userId)).toJSON())));

  router.get("/subscriptions", handler({ query: paginationQuerySchema.extend({ status: z.enum(SUBSCRIPTION_STATUSES).optional() }) }, async ({ res, query }) => {
    const filter = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([Subscription.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), Subscription.countDocuments(filter)]);
    const users = await User.find({ _id: { $in: items.map((s) => s.userId) } }).select("name email role").lean();
    const uMap = new Map(users.map((u) => [String(u._id), u]));
    ok(res, items.map((s) => ({ ...s.toJSON(), user: uMap.get(String(s.userId)) })), paginate(query.page, query.limit, total));
  }));
  router.post("/subscriptions/:id/cancel", handler({ params: idParams, body: z.object({ reason: z.string().trim().min(3).max(300) }) }, async ({ req, res, params, body }) => {
    const sub = await Subscription.findOneAndUpdate({ _id: params.id, status: { $in: ["ACTIVE", "PENDING_PAYMENT"] } }, { status: "CANCELLED", cancelledAt: new Date() }, { returnDocument: "after" });
    if (!sub) throw AppError.notFound("Active subscription");
    await audit({ action: "subscription.cancelled", actorId: requireAuth(req).userId, actorRole: "ADMIN", entityType: "Subscription", entityId: params.id, metadata: { reason: body.reason } }, requestMeta(req));
    ok(res, sub.toJSON());
  }));

  // ---- Plans (prices and limits are business settings)
  router.get("/plans", handler({}, async ({ res }) => ok(res, (await SubscriptionPlan.find().sort({ sortOrder: 1 })).map((p) => p.toJSON()))));
  router.post("/plans", handler({ body: planSchema }, async ({ req, res, body }) => {
    if (await SubscriptionPlan.exists({ code: body.code })) throw AppError.conflict("A plan with that code exists");
    const plan = await SubscriptionPlan.create(body);
    await audit({ action: "plan.created", actorId: requireAuth(req).userId, actorRole: "ADMIN", entityType: "SubscriptionPlan", entityId: String(plan._id), metadata: body }, requestMeta(req));
    created(res, plan.toJSON());
  }));
  router.patch("/plans/:id", handler({ params: idParams, body: updatePlanSchema }, async ({ req, res, params, body }) => {
    const before = await SubscriptionPlan.findById(params.id).lean();
    if (!before) throw AppError.notFound("Plan");
    const plan = await SubscriptionPlan.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: "after" });
    await audit({ action: "plan.updated", actorId: requireAuth(req).userId, actorRole: "ADMIN", entityType: "SubscriptionPlan", entityId: params.id, metadata: { before: { priceKes: before.priceKes, listingLimit: before.listingLimit }, changes: body } }, requestMeta(req));
    ok(res, plan!.toJSON());
  }));

  // ---- Categories
  router.get("/categories", handler({}, async ({ res }) => ok(res, (await Category.find().sort({ kind: 1, sortOrder: 1, name: 1 })).map((c) => c.toJSON()))));
  router.post("/categories", handler({ body: categorySchema }, async ({ req, res, body }) => {
    const cat = await Category.create({ ...body, slug: slugify(body.bodyType ?? body.name) });
    clearCategoryCountsCache();
    await audit({ action: "category.created", actorId: requireAuth(req).userId, actorRole: "ADMIN", entityType: "Category", entityId: String(cat._id) }, requestMeta(req));
    created(res, cat.toJSON());
  }));
  router.patch("/categories/:id", handler({ params: idParams, body: updateCategorySchema }, async ({ req, res, params, body }) => {
    const cat = await Category.findByIdAndUpdate(params.id, { $set: body }, { returnDocument: "after" });
    if (!cat) throw AppError.notFound("Category");
    clearCategoryCountsCache();
    await audit({ action: "category.updated", actorId: requireAuth(req).userId, actorRole: "ADMIN", entityType: "Category", entityId: params.id }, requestMeta(req));
    ok(res, cat.toJSON());
  }));

  // ---- Audit logs & settings
  router.get("/audit-logs", handler({ query: auditLogsQuerySchema }, async ({ res, query }) => {
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = new RegExp(`^${escapeRegex(query.action)}`);
    if (query.actorId) filter.actorId = query.actorId;
    if (query.entityId) filter.entityId = query.entityId;
    const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), AuditLog.countDocuments(filter)]);
    const actors = await User.find({ _id: { $in: items.map((i) => i.actorId).filter(Boolean) } }).select("name email").lean();
    const aMap = new Map(actors.map((a) => [String(a._id), a]));
    ok(res, items.map((i) => ({ ...i.toJSON(), actor: i.actorId ? aMap.get(String(i.actorId)) : undefined })), paginate(query.page, query.limit, total));
  }));
  router.get("/settings", handler({}, async ({ res }) => ok(res, await getSettings())));
  router.patch("/settings", handler({ body: platformSettingsSchema }, async ({ req, res, body }) => {
    const actor = requireAuth(req);
    const settings = await updateSettings(body, actor.userId);
    await audit({ action: "settings.updated", actorId: actor.userId, actorRole: "ADMIN", metadata: body }, requestMeta(req));
    ok(res, settings);
  }));

  return router;
}

const tag = "Admin";
const d = (method: "get" | "post" | "patch", path: string, summary: string, extra: Record<string, unknown> = {}) => describeRoute({ method, path: `/admin${path}`, tag, summary, auth: true, ...extra });
d("get", "/overview", "Platform totals and daily series", { query: analyticsRangeSchema });
d("get", "/analytics", "Overview plus top makes, towns and status breakdown", { query: analyticsRangeSchema });
d("get", "/users", "List and search users", { query: adminUsersQuerySchema });
d("get", "/users/:id", "User detail with profiles and listing counts");
d("patch", "/users/:id/status", "Suspend, reactivate or deactivate a user", { body: updateUserStatusSchema });
d("get", "/brokers", "Brokers with verification status", { query: profileQuery });
d("get", "/dealers", "Dealers with verification status", { query: profileQuery });
d("get", "/verifications", "Verification queue", { query: verificationsQuerySchema });
d("get", "/verifications/:id", "Verification detail with decrypted ID and 10-minute document links (audited)");
d("post", "/verifications/:id/decision", "Approve, reject or request more information", { body: verificationDecisionSchema });
d("get", "/vehicles", "All listings; ?status=PENDING_REVIEW is the moderation queue", { query: adminVehiclesQuerySchema });
d("get", "/vehicles/:id", "Listing with reports and possible duplicates");
d("post", "/vehicles/:id/moderate", "Approve, reject, request changes, suspend or reinstate", { body: moderateVehicleSchema });
d("post", "/vehicles/:id/feature", "Feature or unfeature", { body: featureVehicleSchema });
d("post", "/vehicles/:id/verify", "Mark the listing details as verified by staff", { body: verifyVehicleSchema });
d("get", "/reports", "Listing reports", { query: reportsQuerySchema });
d("patch", "/reports/:id", "Resolve or dismiss a report (optionally suspend the listing)", { body: resolveReportSchema });
d("patch", "/reviews/:id", "Hide or show a review");
d("get", "/payments", "Payments with totals by status", { query: paymentsQuerySchema });
d("get", "/payments/:id", "Payment with raw callbacks");
d("post", "/payments/:id/reconcile", "Query Daraja and settle a pending payment");
d("get", "/subscriptions", "Subscriptions");
d("post", "/subscriptions/:id/cancel", "Cancel a subscription");
d("get", "/plans", "All plans");
d("post", "/plans", "Create a plan", { body: planSchema });
d("patch", "/plans/:id", "Change price, limits or features", { body: updatePlanSchema });
d("get", "/categories", "All categories");
d("post", "/categories", "Create a make or body type", { body: categorySchema });
d("patch", "/categories/:id", "Update a category", { body: updateCategorySchema });
d("get", "/audit-logs", "Audit log", { query: auditLogsQuerySchema });
d("get", "/settings", "Platform settings");
d("patch", "/settings", "Update platform settings", { body: platformSettingsSchema });
