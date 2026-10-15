import { Schema, model } from "mongoose";

/**
 * One row per issued refresh token. Tokens rotate on every refresh; each
 * login starts a new `familyId`. Presenting an already-rotated token is treated
 * as theft and revokes the whole family (every device that descends from it).
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    familyId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, enum: ["ROTATED", "LOGOUT", "REUSE_DETECTED", "PASSWORD_RESET", "ADMIN", "SUSPENDED"] },
    clientType: { type: String, enum: ["web", "mobile"], required: true },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });
refreshTokenSchema.index({ familyId: 1 });
// MongoDB removes rows once they expire.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema);
