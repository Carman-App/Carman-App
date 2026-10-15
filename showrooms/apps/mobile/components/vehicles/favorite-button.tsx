import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable } from "react-native";
import { theme } from "@/constants/theme";
import { api, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";

export function useFavoriteIds() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["favorites", "ids", user?.id], queryFn: () => api<string[]>("/favorites/ids"), enabled: !!user, staleTime: 60_000 });
}

export function FavoriteButton({ vehicleId, size = 18 }: { vehicleId: string; size?: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ids = useFavoriteIds();
  const [override, setOverride] = useState<boolean | null>(null);
  const saved = override ?? !!ids.data?.includes(vehicleId);

  async function toggle() {
    if (!user) return router.push("/(auth)/login");
    const next = !saved;
    setOverride(next);
    try {
      await api(`/favorites/${vehicleId}`, { method: next ? "POST" : "DELETE" });
      await qc.invalidateQueries({ queryKey: ["favorites"] });
      setOverride(null);
    } catch (err) {
      setOverride(!next);
      Alert.alert("Couldn't save", errorMessage(err));
    }
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={saved ? "Remove from saved" : "Save vehicle"} accessibilityState={{ selected: saved }} onPress={toggle} hitSlop={8} className="rounded-full bg-white/95 p-2">
      <Ionicons name={saved ? "heart" : "heart-outline"} size={size} color={saved ? theme.accent : theme.ink} />
    </Pressable>
  );
}
