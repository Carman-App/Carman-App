import type { Types } from "mongoose";
import type { z } from "zod";
import type { createReviewSchema, PaginationQuery } from "@showrooms/shared";
import { AppError } from "../../utils/app-error";
import { paginate } from "../../utils/slug";
import { BrokerProfile } from "../brokers/broker-profile.model";
import { DealerProfile } from "../dealers/dealer-profile.model";
import { VehicleInquiry } from "../inquiries/inquiry.model";
import { notify } from "../notifications/notifications.service";
import { User } from "../users/user.model";
import { Review } from "./review.model";

export type ReviewTarget = { type: "BROKER" | "DEALER"; id: Types.ObjectId; ownerUserId: Types.ObjectId };

export async function resolveTarget(type: "BROKER" | "DEALER", slug: string): Promise<ReviewTarget> {
  if (type === "BROKER") {
    const p = await BrokerProfile.findOne({ slug }).select("_id userId").lean();
    if (!p) throw AppError.notFound("Broker");
    return { type, id: p._id, ownerUserId: p.userId };
  }
  const d = await DealerProfile.findOne({ slug }).select("_id ownerId").lean();
  if (!d) throw AppError.notFound("Dealer");
  return { type, id: d._id, ownerUserId: d.ownerId };
}

/**
 * Only buyers who actually dealt with the seller can review them: they need an
 * inquiry the seller acted on, or one at least 24 hours old.
 */
export async function findEligibleInquiry(buyerId: string, target: ReviewTarget) {
  const scope = target.type === "DEALER" ? { dealerId: target.id } : { sellerId: target.ownerUserId, dealerId: null };
  return VehicleInquiry.findOne({
    ...scope,
    buyerId,
    status: { $ne: "SPAM" },
    $or: [{ status: { $in: ["CONTACTED", "SCHEDULED", "CLOSED"] } }, { createdAt: { $lte: new Date(Date.now() - 86_400_000) } }],
  })
    .select("_id")
    .lean();
}

export async function recomputeRating(target: Pick<ReviewTarget, "type" | "id">) {
  const [agg] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { targetType: target.type, targetId: target.id, hidden: false } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const update = { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.count ?? 0 };
  if (target.type === "BROKER") await BrokerProfile.updateOne({ _id: target.id }, update);
  else await DealerProfile.updateOne({ _id: target.id }, update);
}

export async function createReview(buyerId: string, target: ReviewTarget, input: z.output<typeof createReviewSchema>) {
  if (String(target.ownerUserId) === buyerId) throw AppError.badRequest("You can't review yourself");
  const inquiry = await findEligibleInquiry(buyerId, target);
  if (!inquiry) throw AppError.forbidden("You can review a seller after you've contacted them about a vehicle through Showrooms");
  if (await Review.exists({ buyerId, targetType: target.type, targetId: target.id })) throw AppError.conflict("You've already reviewed this seller");

  const review = await Review.create({ buyerId, targetType: target.type, targetId: target.id, inquiryId: inquiry._id, rating: input.rating, comment: input.comment });
  await recomputeRating(target);
  await notify(target.ownerUserId, { type: "NEW_REVIEW", title: "New review", body: `You received a ${input.rating}-star review.`, data: { screen: "profile" } });
  return review.toJSON();
}

export async function listReviews(target: Pick<ReviewTarget, "type" | "id">, query: PaginationQuery) {
  const filter = { targetType: target.type, targetId: target.id, hidden: false };
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Review.countDocuments(filter),
  ]);
  const buyers = await User.find({ _id: { $in: items.map((r) => r.buyerId) } }).select("name").lean();
  const names = new Map(buyers.map((b) => [String(b._id), b.name]));
  return {
    // Only first name + initial, to protect reviewers' privacy.
    items: items.map((r) => {
      const [first, last] = (names.get(String(r.buyerId)) ?? "Buyer").split(" ");
      return { id: String(r._id), rating: r.rating, comment: r.comment, buyer: { name: last ? `${first} ${last[0]}.` : first }, createdAt: r.createdAt.toISOString() };
    }),
    meta: paginate(query.page, query.limit, total),
  };
}
