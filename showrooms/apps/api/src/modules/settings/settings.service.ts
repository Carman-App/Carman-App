import type { BoostPackage } from "@showrooms/shared";
import type { z } from "zod";
import type { platformSettingsSchema } from "@showrooms/shared";
import { PlatformSetting } from "./settings.model";

export interface PlatformSettings {
  requireListingApproval: boolean;
  autoApproveVerifiedSellers: boolean;
  supportPhone: string;
  supportEmail: string;
  boostPackages: BoostPackage[];
  reportAutoFlagThreshold: number;
  soldListingVisibleDays: number;
  updatedAt?: Date;
}

let cache: { value: PlatformSettings; at: number } | undefined;
const TTL_MS = 15_000;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const doc = await PlatformSetting.findOneAndUpdate({ key: "platform" }, { $setOnInsert: { key: "platform" } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }).lean();
  const value: PlatformSettings = {
    requireListingApproval: doc!.requireListingApproval,
    autoApproveVerifiedSellers: doc!.autoApproveVerifiedSellers,
    supportPhone: doc!.supportPhone,
    supportEmail: doc!.supportEmail,
    boostPackages: (doc!.boostPackages ?? []) as BoostPackage[],
    reportAutoFlagThreshold: doc!.reportAutoFlagThreshold,
    soldListingVisibleDays: doc!.soldListingVisibleDays,
    updatedAt: doc!.updatedAt,
  };
  cache = { value, at: Date.now() };
  return value;
}

export async function updateSettings(input: z.output<typeof platformSettingsSchema>, actorId: string): Promise<PlatformSettings> {
  await PlatformSetting.updateOne({ key: "platform" }, { $set: { ...input, updatedBy: actorId } }, { upsert: true });
  cache = undefined;
  return getSettings();
}

export function clearSettingsCache() {
  cache = undefined;
}
