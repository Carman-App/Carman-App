import { Schema, model } from "mongoose";
import { jsonOptions } from "../../utils/mongoose";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: jsonOptions(["userId"]) },
);
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
// Keep a year of notifications.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 86_400 });
export const Notification = model("Notification", notificationSchema);

const pushTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ["android", "ios", "web"], required: true },
  },
  { timestamps: true },
);
pushTokenSchema.index({ token: 1 }, { unique: true });
pushTokenSchema.index({ userId: 1 });
export const PushToken = model("PushToken", pushTokenSchema);
