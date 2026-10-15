import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { PAYMENT_PURPOSES, PAYMENT_STATUSES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

const paymentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: PAYMENT_PURPOSES, required: true },
    /** Subscription or VehicleBoost id this payment activates. */
    referenceId: { type: Schema.Types.ObjectId, required: true },
    description: { type: String, required: true },
    /** Always computed on the server from the plan/package, never taken from the client. */
    amountKes: { type: Number, required: true, min: 1 },
    phone: { type: String, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "INITIATED", required: true },
    provider: { type: String, default: "MPESA" },
    idempotencyKey: { type: String },
    merchantRequestId: String,
    checkoutRequestId: String,
    mpesaReceiptNumber: String,
    resultCode: String,
    resultDesc: String,
    failureReason: String,
    callbackCount: { type: Number, default: 0 },
    /** Raw callbacks, kept for reconciliation and disputes. */
    callbacks: { type: [Schema.Types.Mixed], default: [], select: false },
    completedAt: Date,
    lastQueriedAt: Date,
    reconciledBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, toJSON: jsonOptions(["callbacks", "idempotencyKey"]) },
);
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ checkoutRequestId: 1 }, { unique: true, partialFilterExpression: { checkoutRequestId: { $type: "string" } } });
paymentSchema.index({ mpesaReceiptNumber: 1 }, { unique: true, partialFilterExpression: { mpesaReceiptNumber: { $type: "string" } } });
paymentSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ purpose: 1, referenceId: 1 });
export type PaymentDoc = HydratedDocument<InferSchemaType<typeof paymentSchema>>;
export const Payment = model("Payment", paymentSchema);
