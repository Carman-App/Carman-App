import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { VERIFICATION_STATUSES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

export const imageRefSchema = new Schema({ url: { type: String, required: true }, publicId: String }, { _id: false });

/** Public trust fields shared by broker and dealer profiles. */
export const trustFields = {
  verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: "UNVERIFIED", required: true },
  verifiedAt: Date,
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  followerCount: { type: Number, default: 0 },
  activeListingCount: { type: Number, default: 0 },
} as const;

const brokerProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    slug: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    bio: String,
    phone: String,
    whatsappNumber: String,
    town: String,
    yearsInBusiness: Number,
    specialties: { type: [String], default: [] },
    logo: imageRefSchema,
    cover: imageRefSchema,
    facebookUrl: String,
    instagramUrl: String,
    tiktokUrl: String,
    ...trustFields,
  },
  { timestamps: true, toJSON: jsonOptions() },
);

brokerProfileSchema.index({ userId: 1 }, { unique: true });
brokerProfileSchema.index({ slug: 1 }, { unique: true });
brokerProfileSchema.index({ verificationStatus: 1, ratingAvg: -1 });
brokerProfileSchema.index({ town: 1, activeListingCount: -1 });
brokerProfileSchema.index({ displayName: "text", bio: "text" });

export type BrokerProfileDoc = HydratedDocument<InferSchemaType<typeof brokerProfileSchema>>;
export const BrokerProfile = model("BrokerProfile", brokerProfileSchema);
