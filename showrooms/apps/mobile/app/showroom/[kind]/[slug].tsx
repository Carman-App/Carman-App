import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Alert, Linking, Text, View } from "react-native";
import { VERIFICATION_EXPLAINER, whatsappLink, type Vehicle } from "@showrooms/shared";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Loading } from "@/components/ui/misc";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { api, apiPaged, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";

interface Profile { id: string; userId?: string; slug: string; displayName?: string; businessName?: string; bio?: string; description?: string; town?: string; phone?: string; whatsappNumber?: string; verificationStatus: string; ratingAvg: number; ratingCount: number; followerCount: number; activeListingCount: number; isFollowing?: boolean }

export default function Showroom() {
  const { kind, slug } = useLocalSearchParams<{ kind: "brokers" | "dealers"; slug: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const p = useQuery({ queryKey: ["showroom", kind, slug, user?.id], queryFn: () => api<Profile>(`/${kind}/${slug}`) });
  const filter = p.data ? (kind === "dealers" ? `dealerId=${p.data.id}` : `sellerId=${p.data.userId}`) : "";
  const cars = useQuery({ queryKey: ["showroom-cars", filter], queryFn: () => apiPaged<Vehicle[]>(`/vehicles?${filter}&sort=newest&limit=30`), enabled: !!p.data });

  async function follow() {
    if (!user) return router.push("/(auth)/login");
    try {
      await api(`/${kind}/${slug}/follow`, { method: p.data?.isFollowing ? "DELETE" : "POST" });
      qc.invalidateQueries({ queryKey: ["showroom", kind, slug] });
    } catch (err) {
      Alert.alert("Couldn't update", errorMessage(err));
    }
  }
  if (p.isLoading) return <Loading />;
  if (!p.data) return <ErrorState message={errorMessage(p.error)} onRetry={() => p.refetch()} />;
  const s = p.data;
  const name = s.displayName ?? s.businessName ?? "";
  const wa = s.whatsappNumber ?? s.phone;
  return (
    <Screen edges={["bottom"]} className="gap-4 pt-4" onRefresh={() => cars.refetch()}>
      <Stack.Screen options={{ title: name }} />
      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-xl bg-ink"><Text className="text-2xl font-bold text-white">{name[0]}</Text></View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-ink">{name}</Text>
            <Text className="text-sm text-ink-muted">{s.town ?? "Kenya"} · {s.activeListingCount} cars · {s.followerCount} followers{s.ratingCount ? ` · ★ ${s.ratingAvg.toFixed(1)}` : ""}</Text>
          </View>
        </View>
        {s.verificationStatus === "VERIFIED" ? <Badge label="Verified seller" tone="info" /> : null}
        {s.bio || s.description ? <Text className="text-ink-muted">{s.bio ?? s.description}</Text> : null}
        <Text className="text-xs text-ink-subtle">{s.verificationStatus === "VERIFIED" ? VERIFICATION_EXPLAINER.broker : "Not verified yet."}</Text>
      </View>
      <View className="flex-row gap-2">
        {wa ? <Button title="WhatsApp" variant="whatsapp" icon="logo-whatsapp" className="flex-1" onPress={() => Linking.openURL(whatsappLink(wa, `Hi ${name}, I found your showroom on Showrooms.`))} /> : null}
        <Button title={s.isFollowing ? "Following" : "Follow"} variant={s.isFollowing ? "outline" : "secondary"} className="flex-1" onPress={follow} />
      </View>
      <Text className="mt-2 text-lg font-bold">Cars for sale</Text>
      {cars.data?.data.length ? <View className="gap-3">{cars.data.data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}</View> : cars.isLoading ? <Loading /> : <EmptyState title="No cars listed right now" />}
    </Screen>
  );
}
