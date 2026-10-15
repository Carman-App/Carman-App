import { Schema, model } from "mongoose";
import { BOOST_STATUSES, BOOST_TYPES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

const vehicleBoostSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: BOOST_TYPES, required: true },
    packageCode: { type: String, required: true },
    days: { type: Number, required: true },
    priceKes: { type: Number, required: true },
    status: { type: String, enum: BOOST_STATUSES, default: "PENDING_PAYMENT", required: true },
    startsAt: Date,
    endsAt: Date,
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
  },
  { timestamps: true, toJSON: jsonOptions() },
);
vehicleBoostSchema.index({ userId: 1, createdAt: -1 });
vehicleBoostSchema.index({ vehicleId: 1, status: 1 });
vehicleBoostSchema.index({ status: 1, endsAt: 1 });
export const VehicleBoost = model("VehicleBoost", vehicleBoostSchema);
