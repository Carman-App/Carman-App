import { Schema, model } from "mongoose";

/**
 * One row per viewer per vehicle per day, so refreshes don't inflate counts.
 * viewerKey is the user id when signed in, otherwise a hash of IP + user agent.
 */
const vehicleViewSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dealerId: { type: Schema.Types.ObjectId, ref: "DealerProfile" },
    viewerId: { type: Schema.Types.ObjectId, ref: "User" },
    viewerKey: { type: String, required: true },
    day: { type: String, required: true },
    source: { type: String, enum: ["web", "mobile", "unknown"], default: "unknown" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
vehicleViewSchema.index({ vehicleId: 1, viewerKey: 1, day: 1 }, { unique: true });
vehicleViewSchema.index({ sellerId: 1, createdAt: -1 });
vehicleViewSchema.index({ dealerId: 1, createdAt: -1 });
vehicleViewSchema.index({ createdAt: -1 });
export const VehicleView = model("VehicleView", vehicleViewSchema);

/**
 * A buyer tapped WhatsApp or Call. This is intent, not a confirmed conversation
 * or sale; analytics label it as "contact clicks".
 */
const contactClickSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dealerId: { type: Schema.Types.ObjectId, ref: "DealerProfile" },
    viewerId: { type: Schema.Types.ObjectId, ref: "User" },
    viewerKey: { type: String, required: true },
    channel: { type: String, enum: ["WHATSAPP", "CALL"], required: true },
    day: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
contactClickSchema.index({ vehicleId: 1, viewerKey: 1, channel: 1, day: 1 }, { unique: true });
contactClickSchema.index({ sellerId: 1, createdAt: -1 });
contactClickSchema.index({ dealerId: 1, createdAt: -1 });
export const ContactClick = model("ContactClick", contactClickSchema);
