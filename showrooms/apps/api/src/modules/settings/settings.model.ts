import { Schema, model } from "mongoose";

/** Singleton document (`key: "platform"`) holding admin-configurable business rules. */
const platformSettingSchema = new Schema(
  {
    key: { type: String, required: true },
    requireListingApproval: { type: Boolean, default: true },
    autoApproveVerifiedSellers: { type: Boolean, default: false },
    supportPhone: { type: String, default: "+254700000000" },
    supportEmail: { type: String, default: "support@showrooms.co.ke" },
    boostPackages: {
      type: [new Schema({ code: String, name: String, type: { type: String, enum: ["BOOST", "FEATURED"] }, days: Number, priceKes: Number }, { _id: false })],
      default: [
        { code: "BOOST_7", name: "Boost for 7 days", type: "BOOST", days: 7, priceKes: 300 },
        { code: "BOOST_14", name: "Boost for 14 days", type: "BOOST", days: 14, priceKes: 500 },
        { code: "FEATURED_7", name: "Featured for 7 days", type: "FEATURED", days: 7, priceKes: 1000 },
      ],
    },
    reportAutoFlagThreshold: { type: Number, default: 3 },
    soldListingVisibleDays: { type: Number, default: 14 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);
platformSettingSchema.index({ key: 1 }, { unique: true });
export const PlatformSetting = model("PlatformSetting", platformSettingSchema);
