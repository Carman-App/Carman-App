import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { USER_ROLES, USER_STATUSES } from "@showrooms/shared";
import { jsonOptions } from "../../utils/mongoose";

const mediaSchema = new Schema({ url: { type: String, required: true }, publicId: String }, { _id: false });

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    /** E.164 (+254...), normalised before saving. */
    phone: { type: String },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: "BUYER" },
    avatar: { type: mediaSchema },
    status: { type: String, enum: USER_STATUSES, required: true, default: "ACTIVE" },
    suspendedReason: { type: String },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, toJSON: jsonOptions(["passwordHash", "passwordChangedAt", "suspendedReason"]) },
);

userSchema.index({ email: 1 }, { unique: true });
// Phone is optional, so uniqueness only applies to documents that have one.
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
userSchema.index({ role: 1, status: 1, createdAt: -1 });

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttrs>;
export const User = model("User", userSchema);
