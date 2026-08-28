"use server";

import { revalidatePath } from "next/cache";
import { ConfigObjectType, CurrencySymbolPlacement, DistanceUnit, VolumeUnit } from "@/generated/prisma/enums";
import { stageDraft } from "@/lib/config/versioning";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

const SYMBOL_PLACEMENTS = Object.values(CurrencySymbolPlacement) as string[];
const DISTANCE_UNITS = Object.values(DistanceUnit) as string[];
const VOLUME_UNITS = Object.values(VolumeUnit) as string[];

export async function stageCountryDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const code = String(formData.get("code") || "").trim().toUpperCase();
  const name = String(formData.get("name") || "").trim();
  const currencyCode = String(formData.get("currencyCode") || "").trim().toUpperCase();
  const currencySymbol = String(formData.get("currencySymbol") || "").trim();
  const currencySymbolPlacement = String(formData.get("currencySymbolPlacement") || "BEFORE");
  const distanceUnit = String(formData.get("distanceUnit") || "KM");
  const volumeUnit = String(formData.get("volumeUnit") || "LITRE");
  const dateFormat = String(formData.get("dateFormat") || "").trim();
  const flagEmoji = String(formData.get("flagEmoji") || "").trim() || null;
  const isLive = formData.get("isLive") === "on";
  const note = String(formData.get("note") || "").trim() || undefined;

  if (!/^[A-Z]{2}$/.test(code)) return { error: "Code must be a 2-letter ISO 3166-1 alpha-2 code." };
  if (!name) return { error: "Name is required." };
  if (!currencyCode) return { error: "Currency code is required." };
  if (!currencySymbol) return { error: "Currency symbol is required." };
  if (!SYMBOL_PLACEMENTS.includes(currencySymbolPlacement)) return { error: "Invalid symbol placement." };
  if (!DISTANCE_UNITS.includes(distanceUnit)) return { error: "Invalid distance unit." };
  if (!VOLUME_UNITS.includes(volumeUnit)) return { error: "Invalid volume unit." };
  if (!dateFormat) return { error: "Date format is required." };

  await stageDraft({
    objectType: ConfigObjectType.COUNTRY,
    objectKey: code,
    payload: {
      code,
      name,
      currencyCode,
      currencySymbol,
      currencySymbolPlacement,
      distanceUnit,
      volumeUnit,
      dateFormat,
      flagEmoji,
      isLive,
    },
    note,
  });

  revalidatePath(`/config/countries/${code}`);
  revalidatePath("/config");
  return { ok: true, message: "Draft staged." };
}
