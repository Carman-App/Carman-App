import { Schema, model } from "mongoose";
import { INQUIRY_STATUSES, INQUIRY_TYPES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

const inquirySchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dealerId: { type: Schema.Types.ObjectId, ref: "DealerProfile" },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: INQUIRY_TYPES, required: true },
    status: { type: String, enum: INQUIRY_STATUSES, default: "NEW", required: true },
    message: { type: String, default: "" },
    phone: String,
    preferredDate: Date,
    sellerNote: String,
  },
  { timestamps: true, toJSON: jsonOptions() },
);
inquirySchema.index({ sellerId: 1, status: 1, createdAt: -1 });
inquirySchema.index({ dealerId: 1, status: 1, createdAt: -1 });
inquirySchema.index({ buyerId: 1, createdAt: -1 });
inquirySchema.index({ vehicleId: 1, buyerId: 1, type: 1 });
inquirySchema.index({ createdAt: -1 });
export const VehicleInquiry = model("VehicleInquiry", inquirySchema);
