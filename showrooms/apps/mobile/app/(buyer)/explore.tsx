import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LABELS, VEHICLE_SORTS } from "@showrooms/shared";
import { SelectField, toOptions } from "@/components/ui/field";
import { EmptyState, ErrorState, Loading } from "@/components/ui/misc";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { theme } from "@/constants/theme";
import { useVehicleSearch } from "@/features/vehicles/queries";
import { errorMessage } from "@/services/api";
import { activeFilterCount, useFilters } from "@/stores/filters";

export default function Explore() {
  const { filters, set } = useFilters();
  const [text, setText] = useState(filters.q ?? "");
  const q = useVehicleSearch(filters);
  const items = q.data?.pages.flatMap((p) => p.data) ?? [];
  const total = q.data?.pages[0]?.meta.total;
  const count = activeFilterCount(filters);

  // Debounce typing so we don't fire a request per keystroke on slow networks.
  useEffect(() => {
    const t = setTimeout(() => set({ q: text.trim() || undefined }), 400);
    return () => clearTimeout(t);
  }, [text, set]);

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <View className="gap-3 border-b border-border px-4 pb-3 pt-2">
        <View className="h-12 flex-row items-center gap-2 rounded-md border border-border bg-surface px-3">
          <Ionicons name="search" size={18} color={theme.inkMuted} />
          <TextInput accessibilityLabel="Search vehicles" value={text} onChangeText={setText} placeholder="Make or model" placeholderTextColor={theme.inkSubtle} className="flex-1 text-base text-ink" returnKeyType="search" />
          {text ? <Pressable onPress={() => setText("")} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={theme.inkSubtle} /></Pressable> : null}
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" onPress={() => router.push("/filters")} className="h-10 flex-row items-center gap-1.5 rounded-md border border-border px-3">
            <Ionicons name="options-outline" size={16} color={theme.ink} />
            <Text className="font-semibold text-ink">Filters{count ? ` (${count})` : ""}</Text>
          </Pressable>
          <View className="flex-1">
            <SelectField label="" value={filters.sort ?? "recommended"} options={toOptions(VEHICLE_SORTS, LABELS.sort)} onChange={(v) => set({ sort: (v ?? "recommended") as never })} />
          </View>
        </View>
        {total !== undefined ? <Text className="text-xs text-ink-muted">{total.toLocaleString("en-KE")} vehicles</Text> : null}
      </View>
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => <VehicleCard vehicle={item} />}
          contentContainerClassName="gap-3 p-4"
          onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
          onEndReachedThreshold={0.6}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          initialNumToRender={4}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={<EmptyState title="No vehicles match" description="Try widening your price range or removing a filter." icon="car-outline" />}
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.accent} className="py-4" /> : null}
        />
      )}
    </SafeAreaView>
  );
}
