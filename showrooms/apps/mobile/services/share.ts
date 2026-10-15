import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Linking, Share } from "react-native";
import { buildBuyerEnquiryMessage, buildWhatsAppShareMessage, whatsappLink, type Vehicle } from "@showrooms/shared";
import { listingUrl } from "@/constants/config";
import { api } from "./api";

/**
 * Every share opens WhatsApp or the system share sheet with a prefilled
 * message. The user always chooses the chat, group or Status and taps send;
 * nothing is ever sent automatically.
 */
export function sellerShareMessage(vehicle: Vehicle, sellerName: string) {
  return buildWhatsAppShareMessage(vehicle, listingUrl(vehicle.slug), sellerName);
}

export async function shareToWhatsApp(message: string): Promise<void> {
  const app = `whatsapp://send?text=${encodeURIComponent(message)}`;
  if (await Linking.canOpenURL(app).catch(() => false)) await Linking.openURL(app);
  else await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
}

export async function shareSheet(message: string, url?: string) {
  await Share.share({ message, url });
}

/** Opens a WhatsApp chat with the seller, prefilled. */
export async function whatsappSeller(vehicle: Vehicle) {
  const phone = vehicle.seller?.whatsappNumber ?? vehicle.seller?.phone;
  if (!phone) return;
  await Linking.openURL(whatsappLink(phone, buildBuyerEnquiryMessage(vehicle, listingUrl(vehicle.slug))));
}

/** Downloads the 1080×1920 Status poster and opens the share sheet (WhatsApp → My Status). */
export async function sharePoster(vehicle: Vehicle): Promise<void> {
  const { url } = await api<{ url: string }>(`/vehicles/${vehicle.id}/poster`);
  const dir = new Directory(Paths.cache, "posters");
  if (!dir.exists) dir.create();
  const target = new File(dir, `${vehicle.slug}-status.png`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: "Share to WhatsApp Status" });
}
