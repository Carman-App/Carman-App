import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { BODY_TYPES, CONDITIONS, DRIVE_TYPES, FUEL_TYPES, IMPORT_STATUSES, MODERATION_ACTIONS, TRANSMISSIONS, VEHICLE_STATUSES } from "@showrooms/shared";

const imageSchema = new Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true }, width: Number, height: Number },
  { _id: false },
);
const videoSchema = new Schema(
  { url: { type: String, required: true }, publicId: { type: String, required: true }, posterUrl: String, durationSec: Number },
  { _id: false },
);
const moderationEntrySchema = new Schema(
  {
    action: { type: String, enum: [...MODERATION_ACTIONS, "SUBMITTED", "AUTO_APPROVED", "FEATURED", "UNFEATURED", "VERIFIED", "UNVERIFIED"], required: true },
    reason: String,
    by: { type: Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * Drafts may be incomplete, so spec fields are not `required` at the schema
 * level; the service enforces completeness when a listing is submitted.
 */
const vehicleSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dealerId: { type: Schema.Types.ObjectId, ref: "DealerProfile" },
    slug: { type: String, required: true },
    /** Stable short id at the end of the slug, so old links still resolve after a title change. */
    shortId: { type: String, required: true },
    title: { type: String, required: true },
    make: String,
    model: String,
    /** Lowercased make/model for exact, index-backed filtering. */
    makeKey: String,
    modelKey: String,
    year: Number,
    price: Number,
    priceNegotiable: { type: Boolean, default: false },
    mileage: Number,
    fuelType: { type: String, enum: FUEL_TYPES },
    transmission: { type: String, enum: TRANSMISSIONS },
    engineCapacity: Number,
    bodyType: { type: String, enum: BODY_TYPES },
    driveType: { type: String, enum: DRIVE_TYPES },
    color: String,
    condition: { type: String, enum: CONDITIONS },
    importStatus: { type: String, enum: IMPORT_STATUSES, default: "IN_KENYA" },
    location: { town: String, county: String, area: String },
    description: { type: String, default: "" },
    features: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] },
    videos: { type: [videoSchema], default: [] },

    status: { type: String, enum: VEHICLE_STATUSES, default: "DRAFT", required: true },
    rejectionReason: String,
    moderationHistory: { type: [moderationEntrySchema], default: [] },
    /** Admin-confirmed listing details. Separate from the seller being verified. */
    isVerified: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: Date,
    boostedUntil: Date,
    /** 2 = featured, 1 = boosted, 0 = normal. Kept in sync by boosts and the expiry job; drives "recommended" sort. */
    promotionRank: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false },
    flagReasons: { type: [String], default: [] },
    duplicateFingerprint: String,
    possibleDuplicateOf: { type: [Schema.Types.ObjectId], default: [] },

    viewCount: { type: Number, default: 0 },
    whatsappClicks: { type: Number, default: 0 },
    callClicks: { type: Number, default: 0 },
    inquiryCount: { type: Number, default: 0 },
    favoriteCount: { type: Number, default: 0 },
    popularity: { type: Number, default: 0 },

    publishedAt: Date,
    soldAt: Date,
    soldPrice: Number,
    archivedAt: Date,
  },
  { timestamps: true },
);

// Marketplace search: status first (always filtered), then the common filters.
vehicleSchema.index({ status: 1, promotionRank: -1, publishedAt: -1 });
vehicleSchema.index({ status: 1, publishedAt: -1 });
vehicleSchema.index({ status: 1, makeKey: 1, modelKey: 1, price: 1 });
vehicleSchema.index({ status: 1, price: 1 });
vehicleSchema.index({ status: 1, year: -1 });
vehicleSchema.index({ status: 1, mileage: 1 });
vehicleSchema.index({ status: 1, popularity: -1 });
vehicleSchema.index({ status: 1, "location.town": 1, publishedAt: -1 });
vehicleSchema.index({ status: 1, bodyType: 1, publishedAt: -1 });
vehicleSchema.index({ status: 1, isFeatured: 1, featuredUntil: -1 });
vehicleSchema.index({ sellerId: 1, status: 1, updatedAt: -1 });
vehicleSchema.index({ dealerId: 1, status: 1, updatedAt: -1 });
vehicleSchema.index({ slug: 1 }, { unique: true });
vehicleSchema.index({ shortId: 1 }, { unique: true });
vehicleSchema.index({ duplicateFingerprint: 1, status: 1 });
vehicleSchema.index({ flagged: 1, status: 1 });
vehicleSchema.index({ featuredUntil: 1 }, { partialFilterExpression: { isFeatured: true } });
vehicleSchema.index({ boostedUntil: 1 }, { partialFilterExpression: { promotionRank: { $gt: 0 } } });
vehicleSchema.index(
  { title: "text", make: "text", model: "text", description: "text", features: "text" },
  { weights: { title: 10, make: 8, model: 8, features: 2, description: 1 }, name: "vehicle_text" },
);

export type VehicleAttrs = InferSchemaType<typeof vehicleSchema>;
export type VehicleDoc = HydratedDocument<VehicleAttrs>;
export const Vehicle = model("Vehicle", vehicleSchema);
