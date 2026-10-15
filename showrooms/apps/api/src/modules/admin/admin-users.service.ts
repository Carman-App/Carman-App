import type { z } from "zod";
import type { adminUsersQuerySchema, updateUserStatusSchema } from "@showrooms/shared";
import { AppError } from "../../utils/app-error";
import { audit, type RequestMeta } from "../audit/audit.service";
import type { AuthContext } from "../../middleware/auth";
import { RefreshToken } from "../auth/refresh-token.model";
import { User } from "../users/user.model";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listUsers(query: z.output<typeof adminUsersQuerySchema>) {
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    User.countDocuments(filter),
  ]);
  return {
    items: items.map((u) => u.toJSON()),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
}

export async function updateUserStatus(
  actor: AuthContext,
  userId: string,
  input: z.output<typeof updateUserStatusSchema>,
  meta: RequestMeta,
) {
  if (userId === actor.userId) throw AppError.badRequest("You cannot change your own account status");
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound("User");
  if (user.role === "ADMIN") throw AppError.forbidden("Administrator accounts are managed outside the dashboard");

  const previous = user.status;
  user.status = input.status;
  user.suspendedReason = input.status === "ACTIVE" ? undefined : input.reason;
  await user.save();

  if (input.status !== "ACTIVE") {
    await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: "SUSPENDED" } });
  }
  await audit(
    {
      action: "admin.user_status_changed",
      actorId: actor.userId,
      actorRole: actor.role,
      entityType: "User",
      entityId: userId,
      metadata: { from: previous, to: input.status, reason: input.reason },
    },
    meta,
  );
  return user.toJSON();
}
