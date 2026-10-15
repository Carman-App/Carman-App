import { Router, type RequestHandler } from "express";
import type { Model } from "mongoose";
import { z } from "zod";
import {
  createReviewSchema,
  paginationQuerySchema,
  profileListQuerySchema,
  submitVerificationSchema,
  updateBrokerProfileSchema,
  updateDealerProfileSchema,
} from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { publicCache } from "../../middleware/cache";
import { authenticate, authorize, optionalAuth, requireAuth } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { created, handler, ok } from "../../utils/handler";
import { escapeRegex, paginate } from "../../utils/slug";
import { requestMeta } from "../audit/audit.service";
import { BrokerProfile } from "../brokers/broker-profile.model";
import { myVerification, submitVerification } from "../brokers/verification.service";
import { DealerProfile } from "../dealers/dealer-profile.model";
import { BrokerFollow } from "../favorites/favorite.model";
import * as reviews from "../reviews/reviews.service";
import { getEntitlements } from "../subscriptions/entitlements.service";
import { getSellerContext, requireDealerOwner } from "./seller-context";

type Kind = "BROKER" | "DEALER";
const slugParams = z.object({ slug: z.string().min(1).max(100) });

// Broker and dealer profiles share the fields used here; the union is widened for shared queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function profileModel(kind: Kind): Model<any> {
  return kind === "BROKER" ? BrokerProfile : DealerProfile;
}

async function findBySlug(kind: Kind, slug: string) {
  const doc = await (kind === "BROKER" ? BrokerProfile.findOne({ slug }) : DealerProfile.findOne({ slug }));
  if (!doc) throw AppError.notFound(kind === "BROKER" ? "Broker" : "Dealer");
  return doc;
}

/**
 * Routes shared by /brokers and /dealers: directory, public showroom, follow,
 * reviews and verification. Profile editing differs and is added per kind.
 */
function showroomRoutes(kind: Kind, own: RequestHandler[]): Router {
  const router = Router();
  const nameField = kind === "BROKER" ? "displayName" : "businessName";

  router.get(
    "/",
    handler({ query: profileListQuerySchema }, async ({ res, query }) => {
      const filter: Record<string, unknown> = {};
      if (query.town) filter.town = query.town;
      if (query.verified !== undefined) filter.verificationStatus = query.verified ? "VERIFIED" : { $ne: "VERIFIED" };
      if (query.q) filter[nameField] = new RegExp(escapeRegex(query.q), "i");
      const model = profileModel(kind);
      const [items, total] = await Promise.all([
        model.find(filter).sort({ activeListingCount: -1, ratingAvg: -1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit),
        model.countDocuments(filter),
      ]);
      publicCache(res, false, 60);
      ok(res, items.map((i) => (i as { toJSON: () => unknown }).toJSON()), paginate(query.page, query.limit, total));
    }),
  );

  router.get(
    "/me",
    ...own,
    handler({}, async ({ req, res }) => {
      const ctx = await getSellerContext(requireAuth(req));
      const profile = kind === "DEALER" ? ctx.dealer! : ctx.broker!;
      ok(res, { ...profile.toJSON(), dealerRole: ctx.dealerRole, entitlements: await getEntitlements(ctx) });
    }),
  );

  router.get(
    "/verification",
    ...own,
    handler({}, async ({ req, res }) => ok(res, await myVerification(await getSellerContext(requireAuth(req))))),
  );

  router.post(
    "/verification",
    ...own,
    handler({ body: submitVerificationSchema }, async ({ req, res, body }) => {
      created(res, await submitVerification(await getSellerContext(requireAuth(req)), body, requestMeta(req)));
    }),
  );

  router.get(
    "/:slug",
    optionalAuth,
    handler({ params: slugParams }, async ({ req, res, params }) => {
      const profile = await findBySlug(kind, params.slug);
      const json = profile.toJSON() as Record<string, unknown>;
      if (kind === "DEALER") {
        const ctx = { userId: String((profile as { ownerId: unknown }).ownerId), kind, dealer: profile, billingUserId: String((profile as { ownerId: unknown }).ownerId) } as never;
        json.storefrontEnabled = (await getEntitlements(ctx)).features.storefront;
      }
      if (req.auth) json.isFollowing = !!(await BrokerFollow.exists({ userId: req.auth.userId, targetType: kind, targetId: profile._id }));
      publicCache(res, !!req.auth, 60);
      ok(res, json);
    }),
  );

  router.post(
    "/:slug/follow",
    authenticate,
    handler({ params: slugParams }, async ({ req, res, params }) => {
      const userId = requireAuth(req).userId;
      const profile = await findBySlug(kind, params.slug);
      const result = await BrokerFollow.updateOne({ userId, targetType: kind, targetId: profile._id }, { $setOnInsert: { userId, targetType: kind, targetId: profile._id } }, { upsert: true });
      if (result.upsertedCount) await profileModel(kind).updateOne({ _id: profile._id }, { $inc: { followerCount: 1 } });
      ok(res, { following: true });
    }),
  );

  router.delete(
    "/:slug/follow",
    authenticate,
    handler({ params: slugParams }, async ({ req, res, params }) => {
      const profile = await findBySlug(kind, params.slug);
      const result = await BrokerFollow.deleteOne({ userId: requireAuth(req).userId, targetType: kind, targetId: profile._id });
      if (result.deletedCount) await profileModel(kind).updateOne({ _id: profile._id }, { $inc: { followerCount: -1 } });
      ok(res, { following: false });
    }),
  );

  router.get(
    "/:slug/reviews",
    handler({ params: slugParams, query: paginationQuerySchema }, async ({ res, params, query }) => {
      const target = await reviews.resolveTarget(kind, params.slug);
      const { items, meta } = await reviews.listReviews(target, query);
      publicCache(res, false, 60);
      ok(res, items, meta);
    }),
  );

  router.post(
    "/:slug/reviews",
    authenticate,
    handler({ params: slugParams, body: createReviewSchema }, async ({ req, res, params, body }) => {
      const target = await reviews.resolveTarget(kind, params.slug);
      created(res, await reviews.createReview(requireAuth(req).userId, target, body));
    }),
  );

  router.get(
    "/:slug/can-review",
    authenticate,
    handler({ params: slugParams }, async ({ req, res, params }) => {
      const target = await reviews.resolveTarget(kind, params.slug);
      const userId = requireAuth(req).userId;
      const { Review } = await import("../reviews/review.model");
      const [eligible, existing] = await Promise.all([reviews.findEligibleInquiry(userId, target), Review.exists({ buyerId: userId, targetType: kind, targetId: target.id })]);
      ok(res, { canReview: !!eligible && !existing, alreadyReviewed: !!existing });
    }),
  );

  const base = kind === "BROKER" ? "/brokers" : "/dealers";
  const tag = kind === "BROKER" ? "Brokers" : "Dealers";
  describeRoute({ method: "get", path: base, tag, summary: `${tag} directory`, query: profileListQuerySchema });
  describeRoute({ method: "get", path: `${base}/me`, tag, summary: "My profile with plan entitlements", auth: true });
  describeRoute({ method: "get", path: `${base}/verification`, tag, summary: "My verification status", auth: true });
  describeRoute({ method: "post", path: `${base}/verification`, tag, summary: "Submit identity/business documents for verification", auth: true, body: submitVerificationSchema });
  describeRoute({ method: "get", path: `${base}/:slug`, tag, summary: "Public showroom profile" });
  describeRoute({ method: "post", path: `${base}/:slug/follow`, tag, summary: "Follow", auth: true });
  describeRoute({ method: "delete", path: `${base}/:slug/follow`, tag, summary: "Unfollow", auth: true });
  describeRoute({ method: "get", path: `${base}/:slug/reviews`, tag, summary: "Reviews", query: paginationQuerySchema });
  describeRoute({ method: "post", path: `${base}/:slug/reviews`, tag, summary: "Review after contacting the seller", auth: true, body: createReviewSchema, responses: { 201: "Created", 403: "Not eligible yet", 409: "Already reviewed" } });
  return router;
}

export function brokersRoutes(): Router {
  const own = [authenticate, authorize("BROKER")];
  const router = Router();
  router.patch(
    "/me",
    ...own,
    handler({ body: updateBrokerProfileSchema }, async ({ req, res, body }) => {
      const ctx = await getSellerContext(requireAuth(req));
      ctx.broker!.set(body);
      await ctx.broker!.save();
      ok(res, ctx.broker!.toJSON());
    }),
  );
  router.use(showroomRoutes("BROKER", own));
  describeRoute({ method: "patch", path: "/brokers/me", tag: "Brokers", summary: "Update my broker profile", auth: true, body: updateBrokerProfileSchema });
  return router;
}

export function dealersRoutes(staffRouter: Router): Router {
  const own = [authenticate, authorize("DEALER")];
  const router = Router();
  router.patch(
    "/me",
    ...own,
    handler({ body: updateDealerProfileSchema }, async ({ req, res, body }) => {
      const ctx = await getSellerContext(requireAuth(req));
      requireDealerOwner(ctx);
      ctx.dealer!.set(body);
      await ctx.dealer!.save();
      ok(res, ctx.dealer!.toJSON());
    }),
  );
  router.use("/me/staff", ...own, staffRouter);
  router.use(showroomRoutes("DEALER", own));
  describeRoute({ method: "patch", path: "/dealers/me", tag: "Dealers", summary: "Update my dealership (owner only)", auth: true, body: updateDealerProfileSchema });
  return router;
}

/** GET /follows — showrooms the user follows. */
export function followsRoutes(): Router {
  const router = Router();
  router.get(
    "/",
    authenticate,
    handler({}, async ({ req, res }) => {
      const follows = await BrokerFollow.find({ userId: requireAuth(req).userId }).sort({ createdAt: -1 }).limit(200).lean();
      const [brokers, dealers] = await Promise.all([
        BrokerProfile.find({ _id: { $in: follows.filter((f) => f.targetType === "BROKER").map((f) => f.targetId) } }),
        DealerProfile.find({ _id: { $in: follows.filter((f) => f.targetType === "DEALER").map((f) => f.targetId) } }),
      ]);
      ok(res, { brokers: brokers.map((b) => b.toJSON()), dealers: dealers.map((d) => d.toJSON()) });
    }),
  );
  describeRoute({ method: "get", path: "/follows", tag: "Brokers", summary: "Showrooms I follow", auth: true });
  return router;
}
