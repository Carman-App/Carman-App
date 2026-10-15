import type { z } from "zod";
import type { subscribeSchema } from "@showrooms/shared";
import { AppError } from "../../utils/app-error";
import { initiatePayment } from "../payments/payments.service";
import { Payment } from "../payments/payment.model";
import { requireDealerOwner, type SellerContext } from "../sellers/seller-context";
import { User } from "../users/user.model";
import { getEntitlements } from "./entitlements.service";
import { Subscription, SubscriptionPlan } from "./subscription.model";

export async function listPlans(audience?: "BROKER" | "DEALER") {
  const filter: Record<string, unknown> = { isActive: true };
  if (audience) filter.audience = { $in: ["ALL", audience] };
  const plans = await SubscriptionPlan.find(filter).sort({ sortOrder: 1, priceKes: 1 });
  return plans.map((p) => p.toJSON());
}

export async function subscribe(ctx: SellerContext, input: z.output<typeof subscribeSchema>, idempotencyKey?: string) {
  if (ctx.kind === "DEALER") requireDealerOwner(ctx);
  const plan = await SubscriptionPlan.findOne({ code: input.planCode, isActive: true });
  if (!plan) throw AppError.notFound("Plan");
  if (plan.audience !== "ALL" && plan.audience !== ctx.kind) throw AppError.badRequest(`The ${plan.name} plan is for ${plan.audience.toLowerCase()}s`);

  if (plan.priceKes === 0) {
    const now = new Date();
    await Subscription.updateMany({ userId: ctx.billingUserId, status: "ACTIVE" }, { status: "EXPIRED" });
    const sub = await Subscription.create({
      userId: ctx.billingUserId,
      planId: plan._id,
      planCode: plan.code,
      planName: plan.name,
      priceKes: 0,
      periodDays: plan.periodDays,
      status: "ACTIVE",
      startsAt: now,
      endsAt: new Date(now.getTime() + plan.periodDays * 86_400_000),
    });
    return { subscription: sub.toJSON(), payment: null };
  }

  const phone = input.phone ?? (await User.findById(ctx.userId).select("phone").lean())?.phone;
  if (!phone) throw AppError.badRequest("Enter the M-Pesa phone number to pay with");

  const sub = await Subscription.create({
    userId: ctx.billingUserId,
    planId: plan._id,
    planCode: plan.code,
    planName: plan.name,
    priceKes: plan.priceKes,
    periodDays: plan.periodDays,
    status: "PENDING_PAYMENT",
  });
  const payment = await initiatePayment({
    userId: ctx.userId,
    purpose: "SUBSCRIPTION",
    referenceId: sub._id,
    amountKes: plan.priceKes,
    phone,
    description: `${plan.name} plan`,
    accountReference: `SR-${plan.code}`,
    idempotencyKey,
  });
  if (String(payment.referenceId) !== String(sub._id)) {
    // Idempotent replay returned an earlier attempt; drop the duplicate subscription row.
    await sub.deleteOne();
  } else {
    sub.paymentId = payment._id;
    await sub.save();
  }
  const current = await Subscription.findById(payment.referenceId);
  return { subscription: current?.toJSON(), payment: payment.toJSON() };
}

export async function mySubscription(ctx: SellerContext) {
  const [entitlements, active, pending, history] = await Promise.all([
    getEntitlements(ctx),
    Subscription.findOne({ userId: ctx.billingUserId, status: "ACTIVE", endsAt: { $gt: new Date() } }).sort({ endsAt: -1 }),
    Subscription.findOne({ userId: ctx.billingUserId, status: "PENDING_PAYMENT" }).sort({ createdAt: -1 }),
    Subscription.find({ userId: ctx.billingUserId }).sort({ createdAt: -1 }).limit(20),
  ]);
  const pendingPayment = pending?.paymentId ? await Payment.findById(pending.paymentId) : null;
  return {
    entitlements,
    active: active?.toJSON() ?? null,
    pending: pending ? { ...pending.toJSON(), payment: pendingPayment?.toJSON() } : null,
    history: history.map((h) => h.toJSON()),
    canManageBilling: ctx.kind === "BROKER" || ctx.dealerRole === "OWNER",
  };
}

export async function expireSubscriptions(now = new Date()): Promise<number> {
  const res = await Subscription.updateMany({ status: "ACTIVE", endsAt: { $lte: now } }, { status: "EXPIRED" });
  return res.modifiedCount;
}
