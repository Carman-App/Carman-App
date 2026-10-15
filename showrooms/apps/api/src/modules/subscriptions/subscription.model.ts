import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { PLAN_FEATURE_KEYS, SUBSCRIPTION_STATUSES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

/** Prices, limits and features are business settings stored here, editable by admins. */
const subscriptionPlanSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    audience: { type: String, enum: ["BROKER", "DEALER", "ALL"], default: "ALL" },
    priceKes: { type: Number, required: true, min: 0 },
    periodDays: { type: Number, default: 30 },
    listingLimit: { type: Number, required: true },
    staffLimit: { type: Number, default: 0 },
    features: Object.fromEntries(PLAN_FEATURE_KEYS.map((k) => [k, { type: Boolean, default: false }])),
    highlights: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: jsonOptions() },
);
subscriptionPlanSchema.index({ code: 1 }, { unique: true });
export type PlanDoc = HydratedDocument<InferSchemaType<typeof subscriptionPlanSchema>>;
export const SubscriptionPlan = model("SubscriptionPlan", subscriptionPlanSchema);

const subscriptionSchema = new Schema(
  {
    /** The account billed: the broker, or the dealer's owner. */
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
    planCode: { type: String, required: true },
    planName: { type: String, required: true },
    priceKes: { type: Number, required: true },
    periodDays: { type: Number, required: true },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "PENDING_PAYMENT", required: true },
    startsAt: Date,
    endsAt: Date,
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    cancelledAt: Date,
  },
  { timestamps: true, toJSON: jsonOptions() },
);
subscriptionSchema.index({ userId: 1, status: 1, endsAt: -1 });
subscriptionSchema.index({ status: 1, endsAt: 1 });
export const Subscription = model("Subscription", subscriptionSchema);
