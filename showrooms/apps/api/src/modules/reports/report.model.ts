import { Schema, model } from "mongoose";
import { REPORT_REASONS, REPORT_STATUSES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

const vehicleReportSchema = new Schema(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: "" },
    status: { type: String, enum: REPORT_STATUSES, default: "OPEN", required: true },
    resolution: String,
    handledBy: { type: Schema.Types.ObjectId, ref: "User" },
    handledAt: Date,
  },
  { timestamps: true, toJSON: jsonOptions() },
);
vehicleReportSchema.index({ status: 1, createdAt: -1 });
vehicleReportSchema.index({ vehicleId: 1, status: 1 });
// One open report per person per listing.
vehicleReportSchema.index({ vehicleId: 1, reporterId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["OPEN", "REVIEWING"] } } });
export const VehicleReport = model("VehicleReport", vehicleReportSchema);
