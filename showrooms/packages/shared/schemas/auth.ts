import { z } from "zod";
import { SELF_ASSIGNABLE_ROLES } from "../constants/roles";
import { emailSchema, kenyanPhoneSchema } from "./common";

/** UTF-8 byte length without relying on TextEncoder/Buffer, so it works in every runtime. */
function utf8Length(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .refine((v) => utf8Length(v) <= 72, "Password is too long")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use at least one letter and one number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: emailSchema,
  phone: kenyanPhoneSchema.optional(),
  password: passwordSchema,
  role: z.enum(SELF_ASSIGNABLE_ROLES).default("BUYER"),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

/** Mobile clients send the refresh token in the body; browsers rely on the HttpOnly cookie. */
export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
