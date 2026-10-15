import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Vehicle } from "@showrooms/shared";
import { Title } from "@/components/layout/screen";
import { EmptyState, ErrorState, Loading } from "@/components/ui/misc";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { apiPaged, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";

export default function Saved() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["favorites", "list", user?.id], queryFn: () => apiPaged<Vehicle[]>("/favorites?limit=50"), enabled: !!user });
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <FlatList
        data={q.data?.data ?? []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VehicleCard vehicle={item} />}
        contentContainerClassName="gap-3 px-4 pb-6"
        ListHeaderComponent={<Title>Saved</Title>}
        refreshing={q.isRefetching}
        onRefresh={() => q.refetch()}
        ListEmptyComponent={
          !user ? (
            <EmptyState title="Save cars you like" description="Log in to keep a shortlist across your devices." actionTitle="Log in" onAction={() => router.push("/(auth)/login")} icon="heart-outline" />
          ) : q.isLoading ? (
            <Loading />
          ) : q.error ? (
            <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <EmptyState title="No saved cars yet" description="Tap the heart on any listing to save it here." actionTitle="Browse cars" onAction={() => router.push("/(buyer)/explore")} icon="heart-outline" />
          )
        }
      />
    </SafeAreaView>
  );
}
