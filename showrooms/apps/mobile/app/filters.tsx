import { router } from "expo-router";
import { View } from "react-native";
import { BODY_TYPES, CONDITIONS, FUEL_TYPES, IMPORT_STATUSES, LABELS, TOWN_NAMES, TRANSMISSIONS, type VehicleSearchQuery } from "@showrooms/shared";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input, SelectField, toOptions } from "@/components/ui/field";
import { useCategories } from "@/features/vehicles/queries";
import { useFilters } from "@/stores/filters";

const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));
const num = (v: string) => (v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")) : undefined);

export default function Filters() {
  const { filters, set, reset } = useFilters();
  const cats = useCategories();
  const models = cats.data?.makes.find((m) => m.name === filters.make)?.models ?? [];
  const sel = (key: keyof VehicleSearchQuery, label: string, values: readonly string[], labels?: Record<string, string>) => (
    <SelectField label={label} value={filters[key] as string | undefined} options={toOptions(values, labels)} onChange={(v) => set({ [key]: v } as Partial<VehicleSearchQuery>)} placeholder="Any" allowClear />
  );
  return (
    <Screen edges={["bottom"]} className="gap-4 pt-4" footer={<View className="flex-row gap-3 border-t border-border p-4"><Button title="Reset" variant="outline" className="flex-1" onPress={reset} /><Button title="Show results" className="flex-1" onPress={() => router.back()} /></View>}>
      <View className="gap-4">
        <SelectField label="Make" value={filters.make} options={(cats.data?.makes ?? []).map((m) => ({ value: m.name, label: m.name }))} onChange={(v) => set({ make: v, model: undefined })} placeholder="Any make" allowClear />
        {models.length ? sel("model", "Model", models) : null}
        <View className="flex-row gap-3">
          <View className="flex-1"><Input label="Min price (KES)" keyboardType="number-pad" defaultValue={filters.minPrice ? String(filters.minPrice) : ""} onEndEditing={(e) => set({ minPrice: num(e.nativeEvent.text) })} /></View>
          <View className="flex-1"><Input label="Max price (KES)" keyboardType="number-pad" defaultValue={filters.maxPrice ? String(filters.maxPrice) : ""} onEndEditing={(e) => set({ maxPrice: num(e.nativeEvent.text) })} /></View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1"><SelectField label="Year from" value={filters.minYear ? String(filters.minYear) : undefined} options={toOptions(YEARS)} onChange={(v) => set({ minYear: v ? Number(v) : undefined })} placeholder="Any" allowClear /></View>
          <View className="flex-1"><SelectField label="Year to" value={filters.maxYear ? String(filters.maxYear) : undefined} options={toOptions(YEARS)} onChange={(v) => set({ maxYear: v ? Number(v) : undefined })} placeholder="Any" allowClear /></View>
        </View>
        <Input label="Max mileage (km)" keyboardType="number-pad" defaultValue={filters.maxMileage ? String(filters.maxMileage) : ""} onEndEditing={(e) => set({ maxMileage: num(e.nativeEvent.text) })} />
        {sel("town", "Location", TOWN_NAMES)}
        {sel("transmission", "Transmission", TRANSMISSIONS, LABELS.transmission)}
        {sel("fuelType", "Fuel type", FUEL_TYPES, LABELS.fuelType)}
        {sel("bodyType", "Body type", BODY_TYPES, LABELS.bodyType)}
        {sel("condition", "Condition", CONDITIONS, LABELS.condition)}
        {sel("importStatus", "Availability", IMPORT_STATUSES, LABELS.importStatus)}
      </View>
    </Screen>
  );
}
