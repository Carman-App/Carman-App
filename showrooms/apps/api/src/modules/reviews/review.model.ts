import { Schema, model } from "mongoose";
import { jsonOptions } from "../../utils/mongoose";

const reviewSchema = new Schema(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["BROKER", "DEALER"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    /** The inquiry that made this buyer eligible to review. */
    inquiryId: { type: Schema.Types.ObjectId, ref: "VehicleInquiry", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: jsonOptions() },
);
reviewSchema.index({ buyerId: 1, targetType: 1, targetId: 1 }, { unique: true });
reviewSchema.index({ targetType: 1, targetId: 1, hidden: 1, createdAt: -1 });
export const Review = model("Review", reviewSchema);
