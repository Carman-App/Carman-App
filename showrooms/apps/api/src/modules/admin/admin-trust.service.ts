import type { z } from "zod";
import type { reportsQuerySchema, resolveReportSchema, verificationDecisionSchema, verificationsQuerySchema } from "@showrooms/shared";
import type { AuthContext } from "../../middleware/auth";
import { services } from "../../services";
import { AppError } from "../../utils/app-error";
import { decryptField } from "../../utils/crypto";
import { paginate } from "../../utils/slug";
import { audit, type RequestMeta } from "../audit/audit.service";
import { BrokerProfile } from "../brokers/broker-profile.model";
import { BrokerVerification } from "../brokers/verification.model";
import { setProfileVerification } from "../brokers/verification.service";
import { DealerProfile } from "../dealers/dealer-profile.model";
import { notify } from "../notifications/notifications.service";
import { VehicleReport } from "../reports/report.model";
import { User } from "../users/user.model";
import { Vehicle } from "../vehicles/vehicle.model";
import { moderate } from "./admin-vehicles.service";

export async function listVerifications(query: z.output<typeof verificationsQuerySchema>) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.subjectType) filter.subjectType = query.subjectType;
  const [items, total] = await Promise.all([
    BrokerVerification.find(filter).sort({ createdAt: query.status === "PENDING" ? 1 : -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    BrokerVerification.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: items.map((i) => i.userId) } }).select("name email phone").lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return {
    // The list never includes ID numbers or document links.
    items: items.map((v) => ({
      id: String(v._id),
      subjectType: v.subjectType,
      subjectId: String(v.subjectId),
      status: v.status,
      fullName: v.fullName,
      idType: v.idType,
      businessName: v.businessName,
      documentCount: v.documents.length,
      user: byId.get(String(v.userId)) && { id: String(v.userId), name: byId.get(String(v.userId))!.name, email: byId.get(String(v.userId))!.email },
      createdAt: v.createdAt.toISOString(),
      decidedAt: v.decidedAt?.toISOString(),
    })),
    meta: paginate(query.page, query.limit, total),
  };
}

/** Full submission for an admin, including the decrypted ID number and 10-minute document links. Every view is audited. */
export async function verificationDetail(actor: AuthContext, id: string, meta: RequestMeta) {
  const v = await BrokerVerification.findById(id).select("+idNumberEncrypted +kraPinEncrypted").lean();
  if (!v) throw AppError.notFound("Verification");
  const [user, profile] = await Promise.all([
    User.findById(v.userId).select("name email phone createdAt").lean(),
    v.subjectType === "BROKER" ? BrokerProfile.findById(v.subjectId).lean() : DealerProfile.findById(v.subjectId).lean(),
  ]);
  await audit({ action: "verification.viewed", actorId: actor.userId, actorRole: actor.role, entityType: "BrokerVerification", entityId: id }, meta);
  const media = services().media;
  return {
    id: String(v._id),
    subjectType: v.subjectType,
    status: v.status,
    fullName: v.fullName,
    idType: v.idType,
    idNumber: decryptField(v.idNumberEncrypted),
    kraPin: v.kraPinEncrypted ? decryptField(v.kraPinEncrypted) : undefined,
    businessName: v.businessName,
    businessRegNumber: v.businessRegNumber,
    reviewNotes: v.reviewNotes,
    createdAt: v.createdAt.toISOString(),
    decidedAt: v.decidedAt?.toISOString(),
    documents: v.documents.map((d) => ({ kind: d.kind, url: media.configured ? media.privateUrl(d.publicId!, d.format ?? "jpg", 600) : undefined })),
    user: user && { id: String(user._id), name: user.name, email: user.email, phone: user.phone, memberSince: user.createdAt.toISOString() },
    profile: profile && { id: String(profile._id), slug: profile.slug, name: "displayName" in profile ? profile.displayName : (profile as { businessName: string }).businessName },
  };
}

export async function decideVerification(actor: AuthContext, id: string, input: z.output<typeof verificationDecisionSchema>, meta: RequestMeta) {
  const v = await BrokerVerification.findById(id);
  if (!v) throw AppError.notFound("Verification");
  if (v.status !== "PENDING" && v.status !== "INFO_REQUESTED") throw AppError.conflict("This request has already been decided");

  const status = input.decision === "APPROVE" ? "VERIFIED" : input.decision === "REJECT" ? "REJECTED" : "INFO_REQUESTED";
  v.status = status;
  v.reviewNotes = input.notes;
  v.reviewerId = actor.userId as never;
  v.decidedAt = new Date();
  await v.save();
  await setProfileVerification(v.subjectType, v.subjectId, status);
  await audit({ action: `verification.${input.decision.toLowerCase()}`, actorId: actor.userId, actorRole: actor.role, entityType: "BrokerVerification", entityId: id, metadata: { notes: input.notes } }, meta);

  const messages = {
    APPROVE: ["You're verified", "Your identity has been verified. Buyers now see a verified badge on your showroom."],
    REJECT: ["Verification not approved", input.notes ?? ""],
    REQUEST_INFO: ["More information needed", input.notes ?? ""],
  } as const;
  const [title, body] = messages[input.decision];
  await notify(v.userId, { type: `VERIFICATION_${input.decision}`, title, body, data: { screen: "verification" }, email: true });
  return verificationDetail(actor, id, meta);
}

export async function listReports(query: z.output<typeof reportsQuerySchema>) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    VehicleReport.find(filter).sort({ createdAt: query.status === "OPEN" ? 1 : -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    VehicleReport.countDocuments(filter),
  ]);
  const [vehicles, reporters] = await Promise.all([
    Vehicle.find({ _id: { $in: items.map((r) => r.vehicleId) } }).select("title slug status images").lean(),
    User.find({ _id: { $in: items.map((r) => r.reporterId) } }).select("name email").lean(),
  ]);
  const vMap = new Map(vehicles.map((v) => [String(v._id), v]));
  const uMap = new Map(reporters.map((u) => [String(u._id), u]));
  return {
    items: items.map((r) => {
      const v = vMap.get(String(r.vehicleId));
      const u = uMap.get(String(r.reporterId));
      return {
        ...r.toJSON(),
        vehicleId: String(r.vehicleId),
        vehicle: v && { id: String(v._id), title: v.title, slug: v.slug, status: v.status, image: v.images[0]?.url },
        reporter: u && { id: String(u._id), name: u.name, email: u.email },
      };
    }),
    meta: paginate(query.page, query.limit, total),
  };
}

export async function resolveReport(actor: AuthContext, id: string, input: z.output<typeof resolveReportSchema>, meta: RequestMeta) {
  const report = await VehicleReport.findById(id);
  if (!report) throw AppError.notFound("Report");
  report.status = input.status;
  report.resolution = input.resolution;
  report.handledBy = actor.userId as never;
  report.handledAt = new Date();
  await report.save();
  await audit({ action: `report.${input.status.toLowerCase()}`, actorId: actor.userId, actorRole: actor.role, entityType: "VehicleReport", entityId: id, metadata: { resolution: input.resolution } }, meta);

  if (input.suspendVehicle) {
    const vehicle = await Vehicle.findById(report.vehicleId).select("status");
    if (vehicle && ["ACTIVE", "PENDING_REVIEW", "SOLD"].includes(vehicle.status)) {
      await moderate(actor, String(report.vehicleId), { action: "SUSPEND", reason: input.resolution ?? `Reported: ${report.reason}` }, meta);
    }
  }
  // Clear the flag once no reports remain open.
  if (input.status !== "REVIEWING" && !(await VehicleReport.exists({ vehicleId: report.vehicleId, status: { $in: ["OPEN", "REVIEWING"] } }))) {
    await Vehicle.updateOne({ _id: report.vehicleId }, { $pull: { flagReasons: "REPORTED" } });
    await Vehicle.updateOne({ _id: report.vehicleId, flagReasons: { $size: 0 } }, { flagged: false });
  }
  return report.toJSON();
}
