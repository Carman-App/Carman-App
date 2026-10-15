import type { Types } from "mongoose";
import type { AuthContext } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { uniqueSlug } from "../../utils/slug";
import { BrokerProfile, type BrokerProfileDoc } from "../brokers/broker-profile.model";
import { DealerProfile, type DealerProfileDoc } from "../dealers/dealer-profile.model";
import { User } from "../users/user.model";

export type DealerRole = "OWNER" | "MANAGER" | "SALES";

/**
 * Who is acting as a seller and on whose behalf. Brokers act for themselves.
 * Dealer owners and staff act for one dealership; everything they touch is
 * scoped to that dealer's id, never to ids supplied by the client.
 */
export interface SellerContext {
  userId: string;
  kind: "BROKER" | "DEALER";
  broker?: BrokerProfileDoc;
  dealer?: DealerProfileDoc;
  dealerRole?: DealerRole;
  /** Whose subscription applies: the broker, or the dealer's owner. */
  billingUserId: string;
}

export async function createBrokerProfile(userId: Types.ObjectId | string, name: string, phone?: string | null) {
  return BrokerProfile.create({
    userId,
    displayName: name,
    slug: await uniqueSlug(BrokerProfile as never, name),
    phone: phone ?? undefined,
    whatsappNumber: phone ?? undefined,
  });
}

export async function createDealerProfile(ownerId: Types.ObjectId | string, name: string, phone?: string | null) {
  return DealerProfile.create({
    ownerId,
    businessName: name,
    slug: await uniqueSlug(DealerProfile as never, name),
    phone: phone ?? undefined,
    whatsappNumber: phone ?? undefined,
  });
}

export async function getSellerContext(auth: AuthContext): Promise<SellerContext> {
  if (auth.role === "BROKER") {
    let broker = await BrokerProfile.findOne({ userId: auth.userId });
    if (!broker) {
      const user = await User.findById(auth.userId);
      broker = await createBrokerProfile(auth.userId, user?.name ?? "Broker", user?.phone);
    }
    return { userId: auth.userId, kind: "BROKER", broker, billingUserId: auth.userId };
  }

  if (auth.role === "DEALER") {
    const owned = await DealerProfile.findOne({ ownerId: auth.userId });
    if (owned) return { userId: auth.userId, kind: "DEALER", dealer: owned, dealerRole: "OWNER", billingUserId: auth.userId };

    const employer = await DealerProfile.findOne({ "staff.userId": auth.userId });
    if (employer) {
      const member = employer.staff.find((s) => String(s.userId) === auth.userId)!;
      return { userId: auth.userId, kind: "DEALER", dealer: employer, dealerRole: member.staffRole, billingUserId: String(employer.ownerId) };
    }

    const user = await User.findById(auth.userId);
    const dealer = await createDealerProfile(auth.userId, user?.name ?? "Dealership", user?.phone);
    return { userId: auth.userId, kind: "DEALER", dealer, dealerRole: "OWNER", billingUserId: auth.userId };
  }

  throw AppError.forbidden("Only broker and dealer accounts can do this");
}

/** Mongo filter for the vehicles this seller context manages. */
export function inventoryFilter(ctx: SellerContext): Record<string, unknown> {
  return ctx.kind === "DEALER" ? { dealerId: ctx.dealer!._id } : { sellerId: ctx.userId, dealerId: null };
}

export function canManageVehicle(ctx: SellerContext, vehicle: { sellerId: unknown; dealerId?: unknown }): boolean {
  if (ctx.kind === "DEALER") return !!vehicle.dealerId && String(vehicle.dealerId) === String(ctx.dealer!._id);
  return !vehicle.dealerId && String(vehicle.sellerId) === ctx.userId;
}

export function requireDealerOwner(ctx: SellerContext): void {
  if (ctx.kind !== "DEALER" || ctx.dealerRole !== "OWNER") throw AppError.forbidden("Only the dealership owner can do this");
}

export function profileIdOf(ctx: SellerContext): string {
  return String(ctx.kind === "DEALER" ? ctx.dealer!._id : ctx.broker!._id);
}
