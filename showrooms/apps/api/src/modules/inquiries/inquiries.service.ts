import type { z } from "zod";
import type { createInquirySchema, inquiriesQuerySchema, updateInquirySchema } from "@showrooms/shared";
import { formatKes } from "@showrooms/shared";
import type { AuthContext } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { paginate } from "../../utils/slug";
import { DealerProfile } from "../dealers/dealer-profile.model";
import { notify } from "../notifications/notifications.service";
import { inventoryFilter, type SellerContext } from "../sellers/seller-context";
import { User } from "../users/user.model";
import { Vehicle } from "../vehicles/vehicle.model";
import { POPULARITY } from "../vehicles/vehicles.service";
import { VehicleInquiry } from "./inquiry.model";

const OPEN = ["NEW", "CONTACTED", "SCHEDULED"] as const;
const DAILY_LIMIT = 20;

export async function createInquiry(auth: AuthContext, vehicleId: string, input: z.output<typeof createInquirySchema>) {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle || vehicle.status !== "ACTIVE") throw AppError.notFound("Vehicle");
  if (String(vehicle.sellerId) === auth.userId) throw AppError.badRequest("You can't send an inquiry about your own listing");
  if (auth.role === "ADMIN") throw AppError.forbidden("Admins can't send inquiries");

  const duplicate = await VehicleInquiry.exists({ vehicleId, buyerId: auth.userId, type: input.type, status: { $in: OPEN } });
  if (duplicate) {
    throw AppError.conflict(input.type === "VIEWING_REQUEST" ? "You already have a viewing request open for this vehicle" : "You already asked about this vehicle; the seller will reply soon");
  }
  const today = await VehicleInquiry.countDocuments({ buyerId: auth.userId, createdAt: { $gt: new Date(Date.now() - 86_400_000) } });
  if (today >= DAILY_LIMIT) throw new AppError(429, "RATE_LIMITED", "You've sent a lot of inquiries today. Try again tomorrow.");

  const buyer = await User.findById(auth.userId).select("name phone");
  const inquiry = await VehicleInquiry.create({
    vehicleId,
    sellerId: vehicle.sellerId,
    dealerId: vehicle.dealerId,
    buyerId: auth.userId,
    type: input.type,
    message: input.message,
    phone: input.phone ?? buyer?.phone,
    preferredDate: input.preferredDate,
  });
  await Vehicle.updateOne({ _id: vehicle._id }, { $inc: { inquiryCount: 1, popularity: POPULARITY.inquiry } });

  // Dealer leads go to whoever listed it and to the dealership owner.
  const recipients = [String(vehicle.sellerId)];
  if (vehicle.dealerId) {
    const dealer = await DealerProfile.findById(vehicle.dealerId).select("ownerId").lean();
    if (dealer && !recipients.includes(String(dealer.ownerId))) recipients.push(String(dealer.ownerId));
  }
  const when = input.preferredDate ? ` for ${input.preferredDate.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}` : "";
  await notify(recipients, {
    type: input.type === "VIEWING_REQUEST" ? "VIEWING_REQUESTED" : "NEW_QUESTION",
    title: input.type === "VIEWING_REQUEST" ? `Viewing request: ${vehicle.title}` : `New question: ${vehicle.title}`,
    body: `${buyer?.name ?? "A buyer"} ${input.type === "VIEWING_REQUEST" ? `wants to view it${when}` : "sent a question"} (${formatKes(vehicle.price ?? 0)}).`,
    data: { inquiryId: String(inquiry._id), vehicleId: String(vehicle._id), screen: "leads" },
    email: true,
  });
  return inquiry.toJSON();
}

async function withVehicles(inquiries: { vehicleId: unknown; buyerId: unknown; toJSON?: () => unknown }[], includeBuyer: boolean) {
  const vehicleIds = [...new Set(inquiries.map((i) => String(i.vehicleId)))];
  const buyerIds = includeBuyer ? [...new Set(inquiries.map((i) => String(i.buyerId)))] : [];
  const [vehicles, buyers] = await Promise.all([
    Vehicle.find({ _id: { $in: vehicleIds } }).select("slug title price images status").lean(),
    buyerIds.length ? User.find({ _id: { $in: buyerIds } }).select("name phone email").lean() : [],
  ]);
  const vMap = new Map(vehicles.map((v) => [String(v._id), v]));
  const bMap = new Map(buyers.map((b) => [String(b._id), b]));
  return inquiries.map((raw) => {
    const i = (raw as { toJSON: () => Record<string, unknown> }).toJSON();
    const v = vMap.get(String(raw.vehicleId));
    const b = bMap.get(String(raw.buyerId));
    return {
      ...i,
      vehicleId: String(raw.vehicleId),
      buyerId: undefined,
      sellerId: undefined,
      vehicle: v && { id: String(v._id), slug: v.slug, title: v.title, price: v.price, images: v.images.slice(0, 1), status: v.status },
      buyer: b && { id: String(b._id), name: b.name, phone: (i.phone as string | undefined) ?? b.phone, email: b.email },
    };
  });
}

export async function listBuyerInquiries(auth: AuthContext, query: z.output<typeof inquiriesQuerySchema>) {
  const filter: Record<string, unknown> = { buyerId: auth.userId };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  const [items, total] = await Promise.all([
    VehicleInquiry.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    VehicleInquiry.countDocuments(filter),
  ]);
  return { items: await withVehicles(items, false), meta: paginate(query.page, query.limit, total) };
}

export async function listSellerInquiries(ctx: SellerContext, query: z.output<typeof inquiriesQuerySchema>) {
  const filter: Record<string, unknown> = ctx.kind === "DEALER" ? { dealerId: ctx.dealer!._id } : { sellerId: ctx.userId, dealerId: null };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  const [items, total, newCount] = await Promise.all([
    VehicleInquiry.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    VehicleInquiry.countDocuments(filter),
    VehicleInquiry.countDocuments({ ...filter, status: "NEW" }),
  ]);
  return { items: await withVehicles(items, true), meta: { ...paginate(query.page, query.limit, total), newCount } };
}

export async function updateSellerInquiry(ctx: SellerContext, id: string, input: z.output<typeof updateInquirySchema>) {
  const scope = inventoryFilter(ctx);
  const inquiry = await VehicleInquiry.findOne({ _id: id, ...(scope.dealerId ? { dealerId: scope.dealerId } : { sellerId: ctx.userId, dealerId: null }) });
  if (!inquiry) throw AppError.notFound("Inquiry");
  const previous = inquiry.status;
  inquiry.status = input.status;
  if (input.sellerNote !== undefined) inquiry.sellerNote = input.sellerNote;
  await inquiry.save();

  if (previous !== "SCHEDULED" && input.status === "SCHEDULED") {
    const vehicle = await Vehicle.findById(inquiry.vehicleId).select("title").lean();
    await notify(inquiry.buyerId, {
      type: "VIEWING_SCHEDULED",
      title: "Viewing confirmed",
      body: `The seller confirmed your viewing of the ${vehicle?.title ?? "vehicle"}. Always inspect and verify a vehicle before making payment.`,
      data: { inquiryId: String(inquiry._id), vehicleId: String(inquiry.vehicleId) },
    });
  }
  return (await withVehicles([inquiry], true))[0];
}
