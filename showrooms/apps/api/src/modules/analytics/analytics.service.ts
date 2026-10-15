import { Types, type PipelineStage } from "mongoose";
import { VEHICLE_STATUSES, type AdminOverview, type SellerAnalytics, type VehicleStatus } from "@showrooms/shared";
import { VehicleInquiry } from "../inquiries/inquiry.model";
import { Payment } from "../payments/payment.model";
import { VehicleReport } from "../reports/report.model";
import { BrokerVerification } from "../brokers/verification.model";
import { inventoryFilter, type SellerContext } from "../sellers/seller-context";
import { getEntitlements } from "../subscriptions/entitlements.service";
import { User } from "../users/user.model";
import { ContactClick, VehicleView } from "../vehicles/vehicle-events.model";
import { Vehicle } from "../vehicles/vehicle.model";

const TZ = "Africa/Nairobi";

/** Inclusive list of YYYY-MM-DD days (Nairobi time) ending today. */
export function dayRange(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(new Date(now.getTime() + 3 * 3600_000 - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/** Midnight Nairobi time, `days - 1` days ago. */
export function rangeStart(days: number, now = new Date()): Date {
  return new Date(`${dayRange(days, now)[0]}T00:00:00+03:00`);
}

async function countByDay(model: { aggregate: (p: PipelineStage[]) => Promise<{ _id: string; n: number }[]> } | typeof Vehicle, match: Record<string, unknown>, dateField: string, sumField?: string) {
  const rows = await (model as typeof Vehicle).aggregate<{ _id: string; n: number }>([
    { $match: match },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}`, timezone: TZ } }, n: { $sum: sumField ? `$${sumField}` : 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

function sellerEventScope(ctx: SellerContext): Record<string, unknown> {
  return ctx.kind === "DEALER" ? { dealerId: ctx.dealer!._id } : { sellerId: new Types.ObjectId(ctx.userId), dealerId: null };
}

export async function sellerAnalytics(ctx: SellerContext, days: number): Promise<SellerAnalytics> {
  const now = new Date();
  const from = rangeStart(days, now);
  const scope = sellerEventScope(ctx);
  const inventory = { ...inventoryFilter(ctx) };
  if (ctx.kind === "BROKER") inventory.sellerId = new Types.ObjectId(ctx.userId);
  const advanced = (await getEntitlements(ctx)).features.advancedAnalytics;

  const [views, contacts, inquiries, statusCounts, favorites] = await Promise.all([
    VehicleView.countDocuments({ ...scope, createdAt: { $gte: from } }),
    ContactClick.aggregate<{ _id: string; n: number }>([{ $match: { ...scope, createdAt: { $gte: from } } }, { $group: { _id: "$channel", n: { $sum: 1 } } }]),
    VehicleInquiry.aggregate<{ _id: string; n: number }>([{ $match: { ...scope, createdAt: { $gte: from } } }, { $group: { _id: "$type", n: { $sum: 1 } } }]),
    Vehicle.aggregate<{ _id: VehicleStatus; n: number }>([{ $match: inventory }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Vehicle.aggregate<{ n: number }>([{ $match: inventory }, { $group: { _id: null, n: { $sum: "$favoriteCount" } } }]),
  ]);
  const contactMap = new Map(contacts.map((c) => [c._id, c.n]));
  const inquiryMap = new Map(inquiries.map((c) => [c._id, c.n]));

  const result: SellerAnalytics = {
    range: { days, from: from.toISOString(), to: now.toISOString() },
    totals: {
      views,
      whatsappClicks: contactMap.get("WHATSAPP") ?? 0,
      callClicks: contactMap.get("CALL") ?? 0,
      viewingRequests: inquiryMap.get("VIEWING_REQUEST") ?? 0,
      questions: inquiryMap.get("QUESTION") ?? 0,
      favorites: favorites[0]?.n ?? 0,
    },
    listings: Object.fromEntries(VEHICLE_STATUSES.map((s) => [s, statusCounts.find((c) => c._id === s)?.n ?? 0])) as Record<VehicleStatus, number>,
    advanced,
  };

  // Per-vehicle breakdown for everyone (basic analytics), daily series for paid plans.
  const [vehicleRows, viewRows, contactRows, inquiryRows] = await Promise.all([
    Vehicle.find({ ...inventory, status: { $ne: "ARCHIVED" } }).select("title slug status").sort({ updatedAt: -1 }).limit(advanced ? 300 : 50).lean(),
    VehicleView.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { ...scope, createdAt: { $gte: from } } }, { $group: { _id: "$vehicleId", n: { $sum: 1 } } }]),
    ContactClick.aggregate<{ _id: { v: Types.ObjectId; c: string }; n: number }>([
      { $match: { ...scope, createdAt: { $gte: from } } },
      { $group: { _id: { v: "$vehicleId", c: "$channel" }, n: { $sum: 1 } } },
    ]),
    VehicleInquiry.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { ...scope, createdAt: { $gte: from } } }, { $group: { _id: "$vehicleId", n: { $sum: 1 } } }]),
  ]);
  const vMap = new Map(viewRows.map((r) => [String(r._id), r.n]));
  const iMap = new Map(inquiryRows.map((r) => [String(r._id), r.n]));
  const cMap = new Map(contactRows.map((r) => [`${r._id.v}:${r._id.c}`, r.n]));
  result.perVehicle = vehicleRows
    .map((v) => ({
      id: String(v._id),
      title: v.title,
      slug: v.slug,
      status: v.status,
      views: vMap.get(String(v._id)) ?? 0,
      whatsappClicks: cMap.get(`${v._id}:WHATSAPP`) ?? 0,
      callClicks: cMap.get(`${v._id}:CALL`) ?? 0,
      inquiries: iMap.get(String(v._id)) ?? 0,
    }))
    .sort((a, b) => b.views + b.whatsappClicks * 5 - (a.views + a.whatsappClicks * 5));

  if (advanced) {
    const match = { ...scope, createdAt: { $gte: from } };
    const [vDays, wDays, cDays, iDays] = await Promise.all([
      countByDay(VehicleView as never, match, "createdAt"),
      countByDay(ContactClick as never, { ...match, channel: "WHATSAPP" }, "createdAt"),
      countByDay(ContactClick as never, { ...match, channel: "CALL" }, "createdAt"),
      countByDay(VehicleInquiry as never, match, "createdAt"),
    ]);
    result.series = dayRange(days, now).map((date) => ({
      date,
      views: vDays.get(date) ?? 0,
      whatsappClicks: wDays.get(date) ?? 0,
      callClicks: cDays.get(date) ?? 0,
      inquiries: iDays.get(date) ?? 0,
    }));
  }
  return result;
}

export async function adminOverview(days: number): Promise<AdminOverview> {
  const now = new Date();
  const from = rangeStart(days, now);
  const eatNow = new Date(now.getTime() + 3 * 3600_000);
  const monthStart = new Date(`${eatNow.toISOString().slice(0, 7)}-01T00:00:00+03:00`);

  const [roles, statuses, inquiries, openReports, pendingVerifications, revenue] = await Promise.all([
    User.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$role", n: { $sum: 1 } } }]),
    Vehicle.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    VehicleInquiry.countDocuments(),
    VehicleReport.countDocuments({ status: { $in: ["OPEN", "REVIEWING"] } }),
    BrokerVerification.countDocuments({ status: "PENDING" }),
    Payment.aggregate<{ n: number }>([{ $match: { status: "SUCCESS", completedAt: { $gte: monthStart } } }, { $group: { _id: null, n: { $sum: "$amountKes" } } }]),
  ]);
  const role = new Map(roles.map((r) => [r._id, r.n]));
  const status = new Map(statuses.map((r) => [r._id, r.n]));

  const [listings, registrations, views, inquiryDays, revenueDays] = await Promise.all([
    countByDay(Vehicle as never, { publishedAt: { $gte: from } }, "publishedAt"),
    countByDay(User as never, { createdAt: { $gte: from } }, "createdAt"),
    countByDay(VehicleView as never, { createdAt: { $gte: from } }, "createdAt"),
    countByDay(VehicleInquiry as never, { createdAt: { $gte: from } }, "createdAt"),
    countByDay(Payment as never, { status: "SUCCESS", completedAt: { $gte: from } }, "completedAt", "amountKes"),
  ]);

  return {
    totals: {
      users: [...role.values()].reduce((a, b) => a + b, 0),
      buyers: role.get("BUYER") ?? 0,
      brokers: role.get("BROKER") ?? 0,
      dealers: role.get("DEALER") ?? 0,
      activeListings: status.get("ACTIVE") ?? 0,
      pendingListings: status.get("PENDING_REVIEW") ?? 0,
      soldVehicles: status.get("SOLD") ?? 0,
      inquiries,
      openReports,
      pendingVerifications,
      revenueThisMonthKes: revenue[0]?.n ?? 0,
    },
    series: dayRange(days, now).map((date) => ({
      date,
      listings: listings.get(date) ?? 0,
      registrations: registrations.get(date) ?? 0,
      views: views.get(date) ?? 0,
      inquiries: inquiryDays.get(date) ?? 0,
      revenueKes: revenueDays.get(date) ?? 0,
    })),
  };
}
