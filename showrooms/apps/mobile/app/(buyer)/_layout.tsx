import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { theme } from "@/constants/theme";

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={(focused ? name : `${name}-outline`) as keyof typeof Ionicons.glyphMap} size={22} color={color as string} />;
  };

export default function BuyerTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.accent, tabBarInactiveTintColor: theme.inkMuted, tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" } }}>
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="explore" options={{ title: "Explore", tabBarIcon: icon("search") }} />
      <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: icon("heart") }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: icon("chatbubbles") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("person") }} />
    </Tabs>
  );
}
