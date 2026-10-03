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

export type DeviceInfo = { platform: string | null; os: string | null; model: string | null; appVersion: string | null; build: string | null };

/** The app's device headers (x-carma-platform, x-carma-os, x-carma-device, x-carma-app-version, x-carma-app-build). */
export function deviceFromHeaders(h: Headers): DeviceInfo | null {
  const clip = (v: string | null) => (v ? v.slice(0, 80) : null);
  const d = {
    platform: clip(h.get("x-carma-platform")),
    os: clip(h.get("x-carma-os")),
    model: clip(h.get("x-carma-device")),
    appVersion: clip(h.get("x-carma-app-version")),
    build: clip(h.get("x-carma-app-build")),
  };
  return d.platform || d.appVersion ? d : null;
}

export function recordActivity(accountId: string, device?: DeviceInfo | null): void {
  void setOnce(`active:${accountId}`, ACTIVITY_WINDOW_SECONDS).then((first) => {
    if (!first) return;
    const now = new Date();
    return prisma.account
      .update({ where: { id: accountId }, data: { lastApiRequestAt: now, ...(device ? { lastDevice: { ...device, at: now.toISOString() } } : {}) } })
      .then(
      () => undefined,
      () => undefined,
    );
  });
}
