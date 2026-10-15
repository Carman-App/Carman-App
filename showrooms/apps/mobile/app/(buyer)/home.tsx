import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { POPULAR_TOWNS } from "@showrooms/shared";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Chip, ErrorState, SectionHeader, SkeletonBox } from "@/components/ui/misc";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { theme } from "@/constants/theme";
import { useCategories, useTrustedBrokers, useVehicleList } from "@/features/vehicles/queries";
import { errorMessage } from "@/services/api";
import { isSeller, useAuth } from "@/stores/auth";
import { useFilters } from "@/stores/filters";

function Rail({ title, query, onAll }: { title: string; query: string; onAll: () => void }) {
  const q = useVehicleList(title, query);
  if (q.isSuccess && !q.data.data.length) return null;
  return (
    <View className="mt-6">
      <SectionHeader title={title} action="See all" onAction={onAll} />
      {q.isLoading ? (
        <View className="flex-row gap-3">{[0, 1].map((i) => <SkeletonBox key={i} className="h-60 w-64" />)}</View>
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <FlatList horizontal data={q.data?.data} keyExtractor={(v) => v.id} renderItem={({ item }) => <VehicleCard vehicle={item} horizontal />} ItemSeparatorComponent={() => <View className="w-3" />} showsHorizontalScrollIndicator={false} initialNumToRender={3} />
      )}
    </View>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { filters, set, reset } = useFilters();
  const categories = useCategories();
  const brokers = useTrustedBrokers();
  const explore = (patch: Parameters<typeof set>[0]) => {
    reset();
    set(patch);
    router.push("/(buyer)/explore");
  };
  const town = filters.town;

  return (
    <Screen onRefresh={() => categories.refetch()} refreshing={categories.isRefetching}>
      <Text accessibilityRole="header" className="mt-4 text-3xl font-extrabold text-ink">
        Find your next car
      </Text>
      <Pressable accessibilityRole="search" onPress={() => router.push("/(buyer)/explore")} className="mt-4 h-12 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3">
        <Ionicons name="search" size={18} color={theme.inkMuted} />
        <Text className="text-base text-ink-subtle">Search make or model, e.g. Fielder</Text>
      </Pressable>

      <View className="mt-6">
        <SectionHeader title="Popular makes" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {(categories.data?.makes.filter((m) => m.isPopular) ?? []).map((m) => <Chip key={m.id} label={`${m.name}${m.vehicleCount ? ` · ${m.vehicleCount}` : ""}`} onPress={() => explore({ make: m.name })} />)}
        </ScrollView>
      </View>

      <Rail title="Featured vehicles" query="featured=true&limit=8" onAll={() => explore({ featured: "true" as never })} />
      <Rail title="Recently added" query="sort=newest&limit=10" onAll={() => explore({ sort: "newest" })} />
      {town ? <Rail title={`Near ${town}`} query={`town=${encodeURIComponent(town)}&limit=10`} onAll={() => explore({ town })} /> : (
        <View className="mt-6">
          <SectionHeader title="Cars near you" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {POPULAR_TOWNS.map((t) => <Chip key={t} label={t} onPress={() => set({ town: t as never })} />)}
          </ScrollView>
        </View>
      )}

      <View className="mt-6">
        <SectionHeader title="Popular categories" />
        <View className="flex-row flex-wrap gap-2">
          {(categories.data?.bodyTypes.filter((b) => b.isPopular) ?? []).map((b) => <Chip key={b.id} label={b.name} onPress={() => explore({ bodyType: b.bodyType })} />)}
        </View>
      </View>

      {brokers.data?.length ? (
        <View className="mt-6">
          <SectionHeader title="Trusted brokers" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
            {brokers.data.map((b) => (
              <Pressable key={b.id} accessibilityRole="button" onPress={() => router.push(`/showroom/brokers/${b.slug}`)} className="w-40 rounded-lg border border-border p-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-ink"><Text className="font-bold text-white">{b.displayName[0]}</Text></View>
                <Text numberOfLines={1} className="mt-2 font-semibold text-ink">{b.displayName}</Text>
                <View className="mt-0.5 flex-row items-center gap-1"><Ionicons name="checkmark-circle" size={13} color={theme.verified} /><Text className="text-xs text-ink-muted">{b.town ?? "Kenya"} · {b.activeListingCount} cars</Text></View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!isSeller(user) ? (
        <View className="mt-8 gap-3 rounded-xl bg-ink p-5">
          <Text className="text-xl font-extrabold text-white">Selling cars on WhatsApp? Reach more buyers.</Text>
          <Text className="text-white/75">Get a free showroom and share every listing straight to your Status.</Text>
          <Button title="Start selling" onPress={() => router.push({ pathname: "/(auth)/register", params: { role: "BROKER" } })} />
        </View>
      ) : null}
    </Screen>
  );
}
