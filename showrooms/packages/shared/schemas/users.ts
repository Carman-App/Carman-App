import { z } from "zod";
import { USER_ROLES, USER_STATUSES } from "../constants/roles";
import { kenyanPhoneSchema, paginationQuerySchema } from "./common";

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    // null clears the phone number.
    phone: kenyanPhoneSchema.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const adminUsersQuerySchema = paginationQuerySchema.extend({
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});
export type AdminUsersQuery = z.input<typeof adminUsersQuerySchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
  reason: z.string().trim().max(500).optional(),
});
