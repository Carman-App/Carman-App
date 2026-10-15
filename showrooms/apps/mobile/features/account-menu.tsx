import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { ROLE_LABELS } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { theme } from "@/constants/theme";
import { useAuth } from "@/stores/auth";

export function MenuItem({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-row items-center gap-3 border-b border-border py-4 active:bg-surface">
      <Ionicons name={icon} size={20} color={theme.inkMuted} />
      <Text className="flex-1 text-base text-ink">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.inkSubtle} />
    </Pressable>
  );
}

export function AccountHeader() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <View className="mb-4 flex-row items-center gap-3">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-ink"><Text className="text-xl font-bold text-white">{user.name[0]}</Text></View>
      <View className="flex-1">
        <Text className="text-lg font-bold text-ink">{user.name}</Text>
        <Text className="text-sm text-ink-muted">{user.email} · {ROLE_LABELS[user.role]}</Text>
      </View>
    </View>
  );
}

export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button
      title="Log out"
      variant="outline"
      icon="log-out-outline"
      className="mt-6"
      onPress={() =>
        Alert.alert("Log out?", "", [
          { text: "Cancel", style: "cancel" },
          { text: "Log out", style: "destructive", onPress: async () => { await signOut(); router.replace("/(buyer)/home"); } },
        ])
      }
    />
  );
}
