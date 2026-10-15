import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { EAS_PROJECT_ID } from "@/constants/config";
import { api } from "./api";

let registeredToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/** Asks for permission (once) and registers this device for push. Silently skips simulators and builds without an EAS project id. */
export async function registerForPush(): Promise<void> {
  if (!Device.isDevice || !EAS_PROJECT_ID) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "Showrooms", importance: Notifications.AndroidImportance.HIGH, lightColor: "#C2410C" });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
  await api("/notifications/push-tokens", { method: "POST", body: { token, platform: Platform.OS === "ios" ? "ios" : "android" } });
  registeredToken = token;
}

export async function unregisterPushToken(): Promise<void> {
  if (!registeredToken) return;
  await api("/notifications/push-tokens", { method: "DELETE", body: { token: registeredToken } });
  registeredToken = null;
}
