import "../global.css";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApiError } from "@/services/api";
import { registerForPush } from "@/services/push";
import { AuthProvider, useAuth } from "@/stores/auth";

// Refetch stale data when the app returns to the foreground.
AppState.addEventListener("change", (s) => {
  if (Platform.OS !== "web") focusManager.setFocused(s === "active");
});
onlineManager.setOnline(true);

function PushRegistration() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) registerForPush().catch(() => undefined);
  }, [user]);
  return null;
}

export default function RootLayout() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <PushRegistration />
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: "#1C1F23", headerTitleStyle: { fontWeight: "700" }, contentStyle: { backgroundColor: "#FFFFFF" } }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(buyer)" options={{ headerShown: false }} />
              <Stack.Screen name="(seller)" options={{ headerShown: false }} />
              <Stack.Screen name="vehicle/[slug]" options={{ title: "" }} />
              <Stack.Screen name="listing/[id]" options={{ title: "Add vehicle" }} />
              <Stack.Screen name="showroom/[kind]/[slug]" options={{ title: "" }} />
              <Stack.Screen name="filters" options={{ presentation: "modal", title: "Filters" }} />
              <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
              <Stack.Screen name="analytics" options={{ title: "Analytics" }} />
              <Stack.Screen name="subscription" options={{ title: "Plans" }} />
              <Stack.Screen name="verification" options={{ title: "Get verified" }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
