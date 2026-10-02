import "server-only";
import { prisma } from "@/lib/prisma";
import { setOnce } from "@/lib/redis";

/**
 * "Last active" for Pulse (an API request tied to an account is the
 * active-user signal). Writing it on every request would be one database
 * write per API call; instead it is written at most once per account per
 * ACTIVITY_WINDOW, which is all the daily/weekly/monthly active counts need.
 * Fire-and-forget: bookkeeping never slows down or fails a real request.
 */
const ACTIVITY_WINDOW_SECONDS = 15 * 60;

export function recordActivity(accountId: string): void {
  void setOnce(`active:${accountId}`, ACTIVITY_WINDOW_SECONDS).then((first) => {
    if (!first) return;
    return prisma.account.update({ where: { id: accountId }, data: { lastApiRequestAt: new Date() } }).then(
      () => undefined,
      () => undefined,
    );
  });
}
