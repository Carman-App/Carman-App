import type { z } from "zod";
import type { submitVerificationSchema } from "@showrooms/shared";
import { services } from "../../services";
import { AppError } from "../../utils/app-error";
import { encryptField, maskTail } from "../../utils/crypto";
import { audit, type RequestMeta } from "../audit/audit.service";
import { notify } from "../notifications/notifications.service";
import { profileIdOf, requireDealerOwner, type SellerContext } from "../sellers/seller-context";
import { User } from "../users/user.model";
import { BrokerProfile } from "./broker-profile.model";
import { DealerProfile } from "../dealers/dealer-profile.model";
import { BrokerVerification } from "./verification.model";

export const verificationFolder = (userId: string) => `showrooms/private/verification/${userId}`;

export async function submitVerification(ctx: SellerContext, input: z.output<typeof submitVerificationSchema>, meta: RequestMeta) {
  if (ctx.kind === "DEALER") requireDealerOwner(ctx);
  const profile = ctx.kind === "DEALER" ? ctx.dealer! : ctx.broker!;
  if (profile.verificationStatus === "PENDING") throw AppError.conflict("Your verification is already being reviewed");
  if (profile.verificationStatus === "VERIFIED") throw AppError.conflict("You are already verified");

  // Each document must be a private upload this user made through /uploads/signature.
  const prefix = `${verificationFolder(ctx.userId)}/`;
  const documents = [];
  for (const doc of input.documents) {
    if (!doc.publicId.startsWith(prefix)) throw AppError.badRequest("Upload documents through the verification uploader");
    const asset = await services().media.getAsset(doc.publicId, "image", "authenticated");
    if (!asset) throw AppError.badRequest("One of the documents could not be found. Upload it again.");
    documents.push({ publicId: doc.publicId, kind: doc.kind, format: asset.format });
  }

  const record = await BrokerVerification.create({
    userId: ctx.userId,
    subjectType: ctx.kind,
    subjectId: profileIdOf(ctx),
    status: "PENDING",
    fullName: input.fullName,
    idType: input.idType,
    idNumberEncrypted: encryptField(input.idNumber),
    idNumberLast3: input.idNumber.slice(-3),
    kraPinEncrypted: input.kraPin ? encryptField(input.kraPin) : undefined,
    businessName: input.businessName,
    businessRegNumber: input.businessRegNumber,
    documents,
  });
  profile.verificationStatus = "PENDING";
  await profile.save();

  await audit({ action: "verification.submitted", actorId: ctx.userId, entityType: "BrokerVerification", entityId: String(record._id) }, meta);
  const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }).select("_id").lean();
  await notify(admins.map((a) => a._id), { type: "VERIFICATION_SUBMITTED", title: "New verification request", body: `${input.fullName} submitted documents.`, data: { verificationId: String(record._id) } });
  return myVerification(ctx);
}

/** What the seller sees about their own request: status and reviewer notes, never the stored ID number. */
export async function myVerification(ctx: SellerContext) {
  const profile = ctx.kind === "DEALER" ? ctx.dealer! : ctx.broker!;
  const latest = await BrokerVerification.findOne({ subjectType: ctx.kind, subjectId: profileIdOf(ctx) }).sort({ createdAt: -1 }).lean();
  return {
    status: profile.verificationStatus,
    verifiedAt: profile.verifiedAt?.toISOString(),
    latest: latest && {
      id: String(latest._id),
      status: latest.status,
      submittedAt: latest.createdAt.toISOString(),
      reviewNotes: latest.reviewNotes,
      idNumber: latest.idNumberLast3 ? maskTail(`xxxxx${latest.idNumberLast3}`) : undefined,
      documents: latest.documents.map((d) => ({ kind: d.kind })),
    },
  };
}

export async function setProfileVerification(subjectType: "BROKER" | "DEALER", subjectId: unknown, status: string) {
  const update = { verificationStatus: status, ...(status === "VERIFIED" ? { verifiedAt: new Date() } : { verifiedAt: null }) };
  if (subjectType === "BROKER") await BrokerProfile.updateOne({ _id: subjectId }, update);
  else await DealerProfile.updateOne({ _id: subjectId }, update);
}
