import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { DEALER_STAFF_ROLES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";
import { imageRefSchema, trustFields } from "../brokers/broker-profile.model";

const staffSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    staffRole: { type: String, enum: DEALER_STAFF_ROLES, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const dealerProfileSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    slug: { type: String, required: true },
    businessName: { type: String, required: true, trim: true },
    description: String,
    phone: String,
    whatsappNumber: String,
    email: String,
    town: String,
    address: String,
    openingHours: String,
    website: String,
    logo: imageRefSchema,
    cover: imageRefSchema,
    staff: { type: [staffSchema], default: [] },
    ...trustFields,
  },
  { timestamps: true, toJSON: jsonOptions(["staff"]) },
);

dealerProfileSchema.index({ ownerId: 1 }, { unique: true });
dealerProfileSchema.index({ slug: 1 }, { unique: true });
dealerProfileSchema.index({ "staff.userId": 1 });
dealerProfileSchema.index({ verificationStatus: 1, activeListingCount: -1 });
dealerProfileSchema.index({ businessName: "text", description: "text" });

export type DealerProfileDoc = HydratedDocument<InferSchemaType<typeof dealerProfileSchema>>;
export const DealerProfile = model("DealerProfile", dealerProfileSchema);
