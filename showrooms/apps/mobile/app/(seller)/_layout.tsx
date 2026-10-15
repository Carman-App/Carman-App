import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { Redirect, router, Tabs } from "expo-router";
import { theme } from "@/constants/theme";
import { isSeller, useAuth } from "@/stores/auth";

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={(focused ? name : `${name}-outline`) as keyof typeof Ionicons.glyphMap} size={22} color={color as string} />;
  };

export default function SellerTabs() {
  const { status, user } = useAuth();
  // UI convenience only; the API authorizes every seller request.
  if (status === "anonymous" || (status === "authenticated" && !isSeller(user))) return <Redirect href="/(buyer)/home" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.accent, tabBarInactiveTintColor: theme.inkMuted, tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" } }}>
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: icon("speedometer") }} />
      <Tabs.Screen name="vehicles" options={{ title: "My Vehicles", tabBarIcon: icon("car") }} />
      <Tabs.Screen
        name="add"
        options={{ title: "Add Vehicle", tabBarIcon: icon("add-circle") }}
        listeners={{ tabPress: (e) => { e.preventDefault(); router.push("/listing/new"); } }}
      />
      <Tabs.Screen name="leads" options={{ title: "Leads", tabBarIcon: icon("chatbubbles") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person") }} />
    </Tabs>
  );
}
