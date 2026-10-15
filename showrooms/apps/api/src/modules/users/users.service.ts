import type { PublicUser } from "@showrooms/shared";
import type { z } from "zod";
import type { updateProfileSchema } from "@showrooms/shared";
import { AppError } from "../../utils/app-error";
import { toPublicUser } from "../auth/auth.service";
import { User } from "./user.model";

export async function updateProfile(userId: string, input: z.output<typeof updateProfileSchema>): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound("User");

  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined && input.phone !== user.phone) {
    if (input.phone && (await User.exists({ phone: input.phone, _id: { $ne: user._id } }))) {
      throw AppError.conflict("Another account uses this phone number", "PHONE_TAKEN");
    }
    user.phone = input.phone ?? undefined;
    // A changed number has to be verified again.
    user.phoneVerifiedAt = undefined;
  }
  await user.save();
  return toPublicUser(user);
}
