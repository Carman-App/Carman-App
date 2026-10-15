import { useState } from "react";
import { Alert, Text, View } from "react-native";
import type { Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { ApiError, errorMessage } from "@/services/api";
import { sellerShareMessage, sharePoster, shareSheet, shareToWhatsApp } from "@/services/share";
import { router } from "expo-router";

/** Share options for a live listing. Every option ends with the seller choosing who to send to. */
export function ShareActions({ vehicle, sellerName }: { vehicle: Vehicle; sellerName: string }) {
  const [busy, setBusy] = useState(false);
  const message = sellerShareMessage(vehicle, sellerName);
  async function poster() {
    setBusy(true);
    try {
      await sharePoster(vehicle);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        Alert.alert("Status posters are a Pro feature", err.message, [{ text: "Not now" }, { text: "See plans", onPress: () => router.push("/subscription") }]);
      } else Alert.alert("Couldn't create poster", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-3">
      <View className="rounded-lg bg-surface p-3">
        <Text className="text-sm text-ink">{message}</Text>
      </View>
      <Button title="Share to WhatsApp" variant="whatsapp" icon="logo-whatsapp" size="lg" onPress={() => shareToWhatsApp(message)} />
      <Button title="Status poster (1080×1920)" variant="secondary" icon="image-outline" loading={busy} onPress={poster} />
      <Button title="More share options" variant="outline" icon="share-social-outline" onPress={() => shareSheet(message)} />
    </View>
  );
}
