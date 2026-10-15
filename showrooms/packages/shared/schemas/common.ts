import { z } from "zod";
import { normalizeKenyanPhone } from "../utils/phone";

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address"));

export const kenyanPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeKenyanPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Kenyan mobile number, e.g. 0712 345 678" });
      return z.NEVER;
    }
    return normalized;
  });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
