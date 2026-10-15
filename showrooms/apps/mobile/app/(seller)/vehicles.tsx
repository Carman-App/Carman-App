import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Alert, FlatList, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatKes, imageUrl, LABELS, type Vehicle, type VehicleStatus } from "@showrooms/shared";
import { Title } from "@/components/layout/screen";
import { Badge, Chip, EmptyState, ErrorState, Loading } from "@/components/ui/misc";
import { ShareActions } from "@/features/listing/share-actions";
import { sellerName, useSellerProfile } from "@/features/seller/use-seller";
import { api, apiPaged, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";

const FILTERS: (VehicleStatus | "")[] = ["", "ACTIVE", "PENDING_REVIEW", "DRAFT", "REJECTED", "SOLD"];
const TONE = { ACTIVE: "success", PENDING_REVIEW: "info", REJECTED: "warning", SUSPENDED: "danger" } as const;

export default function MyVehicles() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profile = useSellerProfile();
  const [status, setStatus] = useState<VehicleStatus | "">("");
  const [sharing, setSharing] = useState<Vehicle | null>(null);
  const q = useQuery({ queryKey: ["my-vehicles", status], queryFn: () => apiPaged<Vehicle[]>(`/vehicles/mine?limit=50${status ? `&status=${status}` : ""}`) });

  async function act(v: Vehicle, action: "sold" | "archive") {
    try {
      if (action === "sold") await api(`/vehicles/${v.id}/mark-sold`, { method: "POST", body: {} });
      else await api(`/vehicles/${v.id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["my-vehicles"] });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    } catch (err) {
      Alert.alert("Couldn't update", errorMessage(err));
    }
  }

  function menu(v: Vehicle) {
    const options = [
      { label: "Edit", run: () => router.push(`/listing/${v.id}`) },
      ...(v.status === "ACTIVE" ? [{ label: "Share to WhatsApp", run: () => setSharing(v) }, { label: "View listing", run: () => router.push(`/vehicle/${v.slug}`) }, { label: "Mark as sold", run: () => Alert.alert("Mark as sold?", v.title, [{ text: "Cancel", style: "cancel" }, { text: "Mark sold", onPress: () => act(v, "sold") }]) }] : []),
      ...(v.status !== "SUSPENDED" && v.status !== "ARCHIVED" ? [{ label: v.status === "DRAFT" ? "Delete draft" : "Archive", run: () => act(v, "archive") }] : []),
    ];
    if (Platform.OS === "ios") ActionSheetIOS.showActionSheetWithOptions({ options: [...options.map((o) => o.label), "Cancel"], cancelButtonIndex: options.length }, (i) => options[i]?.run());
    else Alert.alert(v.title, undefined, [...options.map((o) => ({ text: o.label, onPress: o.run })), { text: "Cancel", style: "cancel" as const }]);
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="px-4">
        <Title subtitle={profile.data ? `${profile.data.entitlements.activeListings} of ${profile.data.entitlements.listingLimit} active listings` : undefined}>My vehicles</Title>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3">
          {FILTERS.map((s) => <Chip key={s || "all"} label={s ? LABELS.status[s] : "All"} selected={status === s} onPress={() => setStatus(s)} />)}
        </ScrollView>
      </View>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : (
        <FlatList
          data={q.data?.data ?? []}
          keyExtractor={(v) => v.id}
          contentContainerClassName="gap-2 px-4 pb-6"
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          ListEmptyComponent={<EmptyState title="No vehicles here" description="Add your first car — it takes about three minutes." actionTitle="Add vehicle" onAction={() => router.push("/listing/new")} icon="car-outline" />}
          renderItem={({ item: v }) => (
            <Pressable accessibilityRole="button" accessibilityHint="Shows actions" onPress={() => menu(v)} className="flex-row gap-3 rounded-lg border border-border p-3">
              <View className="h-16 w-20 overflow-hidden rounded-md bg-surface">{v.images[0] ? <Image source={{ uri: imageUrl(v.images[0].url, { width: 200 }) }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}</View>
              <View className="flex-1 gap-0.5">
                <Text numberOfLines={1} className="font-semibold text-ink">{v.title}</Text>
                <Text className="font-bold text-accent">{v.price ? formatKes(v.price) : "No price yet"}</Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Badge label={LABELS.status[v.status]} tone={TONE[v.status as keyof typeof TONE] ?? "neutral"} />
                  <Text className="text-xs text-ink-muted">{v.stats?.views ?? 0} views · {v.stats?.whatsappClicks ?? 0} WhatsApp</Text>
                </View>
                {v.status === "REJECTED" && v.rejectionReason ? <Text className="text-xs text-warning">{v.rejectionReason}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}
      <Modal visible={!!sharing} animationType="slide" transparent onRequestClose={() => setSharing(null)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setSharing(null)} />
        <SafeAreaView edges={["bottom"]} className="gap-3 rounded-t-xl bg-white p-4">
          <Text className="text-lg font-bold">Share {sharing?.title}</Text>
          {sharing ? <ShareActions vehicle={sharing} sellerName={sellerName(profile.data, user?.name)} /> : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
