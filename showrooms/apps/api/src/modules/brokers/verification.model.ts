import { Schema, model } from "mongoose";
import { ID_TYPES, VERIFICATION_DOC_KINDS, VERIFICATION_STATUSES } from "@showrooms/shared";

/**
 * Identity/business verification submission. ID numbers and KRA PINs are
 * encrypted at rest and only decrypted for admins; documents are stored as
 * private ("authenticated") Cloudinary assets reachable only through
 * short-lived signed links.
 */
const brokerVerificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subjectType: { type: String, enum: ["BROKER", "DEALER"], required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: VERIFICATION_STATUSES, default: "PENDING", required: true },
    fullName: { type: String, required: true },
    idType: { type: String, enum: ID_TYPES, required: true },
    idNumberEncrypted: { type: String, required: true, select: false },
    idNumberLast3: String,
    kraPinEncrypted: { type: String, select: false },
    businessName: String,
    businessRegNumber: String,
    documents: {
      type: [new Schema({ publicId: String, kind: { type: String, enum: VERIFICATION_DOC_KINDS }, format: String }, { _id: false })],
      default: [],
    },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User" },
    reviewNotes: String,
    decidedAt: Date,
  },
  { timestamps: true },
);
brokerVerificationSchema.index({ status: 1, createdAt: 1 });
brokerVerificationSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });
brokerVerificationSchema.index({ userId: 1, createdAt: -1 });
export const BrokerVerification = model("BrokerVerification", brokerVerificationSchema);
