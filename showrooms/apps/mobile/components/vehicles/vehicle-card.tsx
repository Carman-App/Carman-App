import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { formatKes, formatMileage, imageUrl, label, type Vehicle } from "@showrooms/shared";
import { theme } from "@/constants/theme";
import { FavoriteButton } from "./favorite-button";

/** Small images over cellular: ask the CDN for a 480px rendition. */
export const VehicleCard = memo(function VehicleCard({ vehicle, horizontal }: { vehicle: Vehicle; horizontal?: boolean }) {
  const img = vehicle.images[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.title}, ${formatKes(vehicle.price)}, ${vehicle.location.town}`}
      onPress={() => router.push(`/vehicle/${vehicle.slug}`)}
      className={`overflow-hidden rounded-lg border border-border bg-white ${horizontal ? "w-64" : ""}`}
    >
      <View className="aspect-[4/3] bg-surface">
        {img ? <Image source={{ uri: imageUrl(img.url, { width: 480 }) }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} recyclingKey={img.publicId} cachePolicy="memory-disk" /> : null}
        <View className="absolute left-2 top-2 flex-row gap-1">
          {vehicle.isFeatured ? <Text className="overflow-hidden rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">Featured</Text> : vehicle.isBoosted ? <Text className="overflow-hidden rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">Promoted</Text> : null}
          {vehicle.status === "SOLD" ? <Text className="overflow-hidden rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">Sold</Text> : null}
        </View>
        <View className="absolute right-2 top-2">
          <FavoriteButton vehicleId={vehicle.id} />
        </View>
      </View>
      <View className="gap-1 p-3">
        <Text numberOfLines={1} className="font-semibold text-ink">
          {vehicle.title}
        </Text>
        <Text className="text-lg font-extrabold text-accent">{formatKes(vehicle.price)}</Text>
        <View className="flex-row flex-wrap gap-x-3">
          <Text className="text-xs text-ink-muted">{formatMileage(vehicle.mileage)}</Text>
          <Text className="text-xs text-ink-muted">{label("transmission", vehicle.transmission)}</Text>
          <Text className="text-xs text-ink-muted">{label("fuelType", vehicle.fuelType)}</Text>
        </View>
        <View className="mt-1 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={13} color={theme.inkMuted} />
            <Text className="text-xs text-ink-muted">{vehicle.location.town}</Text>
          </View>
          {vehicle.seller?.isVerified ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="checkmark-circle" size={13} color={theme.verified} />
              <Text className="text-xs font-semibold text-info">Verified seller</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});
