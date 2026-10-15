import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { UPLOAD_RULES, VEHICLE_LIMITS, type uploadCompleteSchema, type uploadSignatureSchema, type UploadPurpose } from "@showrooms/shared";
import type { AuthContext } from "../../middleware/auth";
import { services } from "../../services";
import type { DeliveryType } from "../../services/media/media.service";
import { AppError } from "../../utils/app-error";
import { verificationFolder } from "../brokers/verification.service";
import { canManageVehicle, getSellerContext, profileIdOf, requireDealerOwner } from "../sellers/seller-context";
import { User } from "../users/user.model";
import { Vehicle } from "../vehicles/vehicle.model";

const MEDIA_OPEN_STATUSES = ["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE"];

/**
 * Where a file for this purpose must live. The folder encodes the owning
 * entity, so /complete can check a publicId belongs to the caller without
 * extra state, and the signature stops uploads to any other path.
 */
async function folderFor(auth: AuthContext, purpose: UploadPurpose, vehicleId?: string): Promise<{ folder: string; delivery: DeliveryType }> {
  switch (purpose) {
    case "VEHICLE_IMAGE":
    case "VEHICLE_VIDEO": {
      if (auth.role !== "BROKER" && auth.role !== "DEALER") throw AppError.forbidden("Only sellers can upload vehicle media");
      const ctx = await getSellerContext(auth);
      const vehicle = vehicleId ? await Vehicle.findById(vehicleId).select("sellerId dealerId status images videos") : null;
      if (!vehicle || !canManageVehicle(ctx, vehicle)) throw AppError.notFound("Vehicle");
      if (!MEDIA_OPEN_STATUSES.includes(vehicle.status)) throw AppError.conflict("Media can't be added to this listing any more");
      if (purpose === "VEHICLE_IMAGE" && vehicle.images.length >= VEHICLE_LIMITS.maxImages) throw AppError.conflict(`A listing can have up to ${VEHICLE_LIMITS.maxImages} photos`);
      if (purpose === "VEHICLE_VIDEO" && vehicle.videos.length >= VEHICLE_LIMITS.maxVideos) throw AppError.conflict(`A listing can have up to ${VEHICLE_LIMITS.maxVideos} videos`);
      return { folder: `showrooms/vehicles/${vehicleId}`, delivery: "upload" };
    }
    case "AVATAR":
      return { folder: `showrooms/avatars/${auth.userId}`, delivery: "upload" };
    case "PROFILE_LOGO":
    case "PROFILE_COVER": {
      const ctx = await getSellerContext(auth);
      if (ctx.kind === "DEALER") requireDealerOwner(ctx);
      return { folder: `showrooms/profiles/${profileIdOf(ctx)}`, delivery: "upload" };
    }
    case "VERIFICATION_DOC": {
      const ctx = await getSellerContext(auth);
      if (ctx.kind === "DEALER") requireDealerOwner(ctx);
      return { folder: verificationFolder(auth.userId), delivery: "authenticated" };
    }
  }
}

export async function createSignature(auth: AuthContext, input: z.output<typeof uploadSignatureSchema>) {
  const rule = UPLOAD_RULES[input.purpose];
  const { folder, delivery } = await folderFor(auth, input.purpose, input.vehicleId);
  return services().media.signUpload({ publicId: `${folder}/${randomUUID()}`, resourceType: rule.resourceType, deliveryType: delivery, maxBytes: rule.maxBytes });
}

const ALLOWED_FORMATS: Record<"image" | "video", string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"],
  video: ["mp4", "mov", "webm"],
};

/** Confirms the upload with the media provider, re-checks size/format, then attaches it. */
export async function completeUpload(auth: AuthContext, input: z.output<typeof uploadCompleteSchema>) {
  const rule = UPLOAD_RULES[input.purpose];
  const { folder, delivery } = await folderFor(auth, input.purpose, input.vehicleId);
  if (!input.publicId.startsWith(`${folder}/`)) throw AppError.forbidden("This file was not uploaded for this purpose");

  const media = services().media;
  const asset = await media.getAsset(input.publicId, rule.resourceType, delivery);
  if (!asset) throw AppError.notFound("Uploaded file");
  const allowed = ALLOWED_FORMATS[rule.resourceType].filter((f) => input.purpose === "VERIFICATION_DOC" || f !== "pdf");
  if (asset.bytes > rule.maxBytes || !allowed.includes(asset.format.toLowerCase())) {
    await media.deleteAsset(asset.publicId, rule.resourceType, delivery);
    throw new AppError(422, "VALIDATION_ERROR", "File type or size not allowed");
  }

  switch (input.purpose) {
    case "VEHICLE_IMAGE":
    case "VEHICLE_VIDEO": {
      const field = input.purpose === "VEHICLE_IMAGE" ? "images" : "videos";
      const max = input.purpose === "VEHICLE_IMAGE" ? VEHICLE_LIMITS.maxImages : VEHICLE_LIMITS.maxVideos;
      const entry =
        field === "images"
          ? { url: asset.secureUrl, publicId: asset.publicId, width: asset.width, height: asset.height }
          : { url: asset.secureUrl, publicId: asset.publicId, durationSec: asset.durationSec, posterUrl: asset.secureUrl.replace(/\.[a-z0-9]+$/i, ".jpg") };
      // Atomic: no duplicate entries on retries, and the cap holds under concurrent uploads.
      const updated = await Vehicle.findOneAndUpdate(
        { _id: input.vehicleId, [`${field}.publicId`]: { $ne: asset.publicId }, [`${field}.${max - 1}`]: { $exists: false } },
        { $push: { [field]: entry } },
        { returnDocument: "after" },
      );
      if (!updated && !(await Vehicle.exists({ _id: input.vehicleId, [`${field}.publicId`]: asset.publicId }))) {
        await media.deleteAsset(asset.publicId, rule.resourceType, delivery);
        throw AppError.conflict(`A listing can have up to ${max} ${field}`);
      }
      return { purpose: input.purpose, ...entry };
    }
    case "AVATAR": {
      const user = await User.findById(auth.userId);
      const previous = user?.avatar?.publicId;
      await User.updateOne({ _id: auth.userId }, { avatar: { url: asset.secureUrl, publicId: asset.publicId } });
      if (previous && previous !== asset.publicId) media.deleteAsset(previous, "image", "upload").catch(() => undefined);
      return { purpose: input.purpose, url: asset.secureUrl, publicId: asset.publicId };
    }
    case "PROFILE_LOGO":
    case "PROFILE_COVER": {
      const ctx = await getSellerContext(auth);
      const profile = ctx.kind === "DEALER" ? ctx.dealer! : ctx.broker!;
      const key = input.purpose === "PROFILE_LOGO" ? "logo" : "cover";
      const previous = profile[key]?.publicId;
      profile.set(key, { url: asset.secureUrl, publicId: asset.publicId });
      await profile.save();
      if (previous && previous !== asset.publicId) media.deleteAsset(previous, "image", "upload").catch(() => undefined);
      return { purpose: input.purpose, url: asset.secureUrl, publicId: asset.publicId };
    }
    case "VERIFICATION_DOC":
      // Private: the URL is never returned; it's referenced by publicId when submitting verification.
      return { purpose: input.purpose, publicId: asset.publicId };
  }
}
