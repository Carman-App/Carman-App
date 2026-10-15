import { Schema, model } from "mongoose";

const favoriteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
favoriteSchema.index({ userId: 1, vehicleId: 1 }, { unique: true });
favoriteSchema.index({ userId: 1, createdAt: -1 });
favoriteSchema.index({ vehicleId: 1 });
export const Favorite = model("Favorite", favoriteSchema);

/** Buyers following a broker or dealer showroom. */
const brokerFollowSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["BROKER", "DEALER"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
brokerFollowSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
brokerFollowSchema.index({ targetType: 1, targetId: 1 });
export const BrokerFollow = model("BrokerFollow", brokerFollowSchema);
