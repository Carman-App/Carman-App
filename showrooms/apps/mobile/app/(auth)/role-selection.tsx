import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SelfAssignableRole } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { theme } from "@/constants/theme";

const ROLES: { role: SelfAssignableRole; title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { role: "BUYER", title: "I'm buying a car", body: "Save cars, follow showrooms, request viewings.", icon: "search" },
  { role: "BROKER", title: "I'm a broker", body: "Your own showroom. Share listings straight to WhatsApp.", icon: "storefront-outline" },
  { role: "DEALER", title: "I'm a dealer", body: "Inventory, staff accounts and a storefront.", icon: "business-outline" },
];

export default function RoleSelection() {
  const [role, setRole] = useState<SelfAssignableRole>("BUYER");
  return (
    <Screen edges={["bottom"]} footer={<View className="p-4"><Button title="Continue" size="lg" onPress={() => router.push({ pathname: "/(auth)/register", params: { role } })} /></View>}>
      <Title subtitle="You can browse cars with any account.">How will you use Showrooms?</Title>
      <View className="gap-3" accessibilityRole="radiogroup">
        {ROLES.map((r) => {
          const on = role === r.role;
          return (
            <Pressable key={r.role} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setRole(r.role)} className={`flex-row gap-3 rounded-lg border p-4 ${on ? "border-accent bg-accent-soft" : "border-border"}`}>
              <Ionicons name={r.icon} size={22} color={on ? theme.accent : theme.inkMuted} />
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">{r.title}</Text>
                <Text className="text-sm text-ink-muted">{r.body}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
