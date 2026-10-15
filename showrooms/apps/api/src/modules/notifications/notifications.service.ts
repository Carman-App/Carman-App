import type { Types } from "mongoose";
import { logger } from "../../config/logger";
import { services } from "../../services";
import { User } from "../users/user.model";
import { Notification, PushToken } from "./notification.model";

export interface NotificationInput {
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Also email the user (important account events only). */
  email?: boolean;
}

type Id = string | Types.ObjectId;

/**
 * In-app notification + Expo push (+ optional email). Never throws: a failed
 * push must not fail the business action that triggered it.
 */
export async function notify(userIds: Id | Id[], input: NotificationInput): Promise<void> {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(String);
  if (ids.length === 0) return;
  try {
    await Notification.insertMany(ids.map((userId) => ({ userId, type: input.type, title: input.title, body: input.body, data: input.data })));

    const tokens = await PushToken.find({ userId: { $in: ids } }).lean();
    if (tokens.length) {
      const { invalidTokens } = await services().push.send(tokens.map((t) => ({ to: t.token, title: input.title, body: input.body, data: input.data })));
      if (invalidTokens.length) await PushToken.deleteMany({ token: { $in: invalidTokens } });
    }

    if (input.email) {
      const users = await User.find({ _id: { $in: ids }, status: "ACTIVE" }).select("email name").lean();
      await Promise.all(
        users.map((u) =>
          services()
            .email.send({ to: u.email, subject: input.title, text: `Hi ${u.name},\n\n${input.body}`, html: `<p>Hi ${u.name},</p><p>${input.body}</p>` })
            .catch((err) => logger.warn({ err }, "Notification email failed")),
        ),
      );
    }
  } catch (err) {
    logger.error({ err, type: input.type }, "Notification failed");
  }
}
