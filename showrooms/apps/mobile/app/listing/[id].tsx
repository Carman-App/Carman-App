import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BODY_TYPES, COMMON_FEATURES, CONDITIONS, DRIVE_TYPES, FUEL_TYPES, IMPORT_STATUSES, LABELS, TOWN_NAMES, TRANSMISSIONS, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Input, SelectField, toOptions } from "@/components/ui/field";
import { Badge, Chip, ErrorState, Loading } from "@/components/ui/misc";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { theme } from "@/constants/theme";
import { EMPTY_FORM, fromVehicle, STEP_FIELDS, toPayload, type ListingForm } from "@/features/listing/form";
import { PhotoManager } from "@/features/listing/photo-manager";
import { ShareActions } from "@/features/listing/share-actions";
import { useCategories } from "@/features/vehicles/queries";
import { sellerName, useSellerProfile } from "@/features/seller/use-seller";
import { api, ApiError, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";

const STEPS = ["Photos", "Vehicle info", "Price & location", "Description", "Preview", "Submit"];
const draftKey = (id: string) => `showrooms.listingDraft.${id}`;

/**
 * Six-step guided listing. The server draft is created on the first photo or
 * "Next", saved on every step, and form edits are also kept on the phone so an
 * interrupted session (call, low battery, lost signal) can resume.
 */
export default function ListingWizard() {
  const params = useLocalSearchParams<{ id: string }>();
  // Freeze the route id: creating the draft later must not remount the wizard.
  const [id] = useState(params.id === "new" ? null : params.id);
  const start = useQuery({
    queryKey: ["listing-start", id],
    enabled: !!id,
    gcTime: 0,
    queryFn: async () => {
      const v = await api<Vehicle>(`/vehicles/${id}`);
      // Prefer an unsynced draft kept on the phone over the server copy.
      const local = await AsyncStorage.getItem(draftKey(v.id)).catch(() => null);
      return { vehicle: v, form: local ? { ...fromVehicle(v), ...(JSON.parse(local) as Partial<ListingForm>) } : fromVehicle(v) };
    },
  });
  if (id && start.isLoading) return <Loading />;
  if (id && !start.data) return <ErrorState message={errorMessage(start.error)} onRetry={() => start.refetch()} />;
  return <Wizard initialVehicle={start.data?.vehicle ?? null} initialForm={start.data?.form ?? EMPTY_FORM} />;
}

function Wizard({ initialVehicle, initialForm }: { initialVehicle: Vehicle | null; initialForm: ListingForm }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const profile = useSellerProfile();
  const cats = useCategories();
  const [vehicle, setVehicle] = useState<Vehicle | null>(initialVehicle);
  const [form, setForm] = useState<ListingForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(initialVehicle && initialVehicle.images.length ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const vehicleId = vehicle?.id ?? null;

  useEffect(() => {
    if (!vehicleId) return;
    const t = setTimeout(() => AsyncStorage.setItem(draftKey(vehicleId), JSON.stringify(form)).catch(() => undefined), 500);
    return () => clearTimeout(t);
  }, [form, vehicleId]);

  const set = <K extends keyof ListingForm>(k: K, v: ListingForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function ensureVehicle(): Promise<Vehicle> {
    if (vehicle) return vehicle;
    const created = await api<Vehicle>("/vehicles", { method: "POST", body: {} });
    setVehicle(created);
    return created;
  }

  async function saveStep(s: number): Promise<boolean> {
    const fields = STEP_FIELDS[s];
    if (!fields) return true;
    const { payload, errors: errs } = toPayload(form, fields);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return false;
    }
    if (!Object.keys(payload).length) return true;
    try {
      const v = await ensureVehicle();
      const updated = await api<Vehicle>(`/vehicles/${v.id}`, { method: "PATCH", body: payload });
      setVehicle(updated);
      qc.invalidateQueries({ queryKey: ["my-vehicles"] });
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setErrors(Object.fromEntries(Object.entries(err.fieldErrors()).map(([k, m]) => [k.startsWith("location") ? "town" : k, m])));
      else Alert.alert("Couldn't save", errorMessage(err));
      return false;
    }
  }

  async function next() {
    setBusy(true);
    try {
      if (step === 1) await ensureVehicle();
      if (await saveStep(step)) setStep((s) => Math.min(6, s + 1));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!vehicle) return;
    setBusy(true);
    try {
      const updated = await api<Vehicle>(`/vehicles/${vehicle.id}/submit`, { method: "POST" });
      setVehicle(updated);
      await AsyncStorage.removeItem(draftKey(vehicle.id));
      qc.invalidateQueries({ queryKey: ["my-vehicles"] });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const f = err.fieldErrors();
        setErrors(f);
        Alert.alert("Almost there", Object.values(f).slice(0, 3).join("\n") || err.message);
        if (f.images) setStep(1);
        else if (Object.keys(f).some((k) => STEP_FIELDS[2]!.includes(k as keyof ListingForm))) setStep(2);
        else if (f.price || Object.keys(f).some((k) => k.startsWith("location"))) setStep(3);
        else if (f.description) setStep(4);
      } else Alert.alert(err instanceof ApiError && err.status === 403 ? "Plan limit reached" : "Couldn't submit", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const submitted = vehicle && (vehicle.status === "ACTIVE" || vehicle.status === "PENDING_REVIEW") && step === 6;
  const models = cats.data?.makes.find((m) => m.name === form.make)?.models ?? [];
  const sel = (k: keyof ListingForm, label: string, values: readonly string[], labels?: Record<string, string>) => (
    <SelectField label={label} value={(form[k] as string) || undefined} options={toOptions(values, labels)} onChange={(v) => set(k, (v ?? "") as never)} error={errors[k]} />
  );

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-white">
      <Stack.Screen options={{ title: vehicle?.title && vehicle.title !== "Untitled vehicle" ? vehicle.title : "Add vehicle" }} />
      <View className="flex-row gap-1 px-4 pt-3" accessibilityLabel={`Step ${step} of 6: ${STEPS[step - 1]}`}>
        {STEPS.map((s, i) => <View key={s} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-accent" : "bg-surface"}`} />)}
      </View>
      <Text className="px-4 pt-2 text-xs font-semibold uppercase text-ink-muted">Step {step} of 6 · {STEPS[step - 1]}</Text>
      {vehicle?.status === "REJECTED" && vehicle.rejectionReason ? <Text className="mx-4 mt-2 rounded-md bg-warning-soft p-3 text-sm text-ink">Changes requested: {vehicle.rejectionReason}</Text> : null}

      <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        {step === 1 && <PhotoManager vehicle={vehicle} onChange={setVehicle} ensureVehicle={ensureVehicle} />}

        {step === 2 && (
          <>
            <SelectField label="Make" value={form.make || undefined} options={(cats.data?.makes ?? []).map((m) => ({ value: m.name, label: m.name }))} onChange={(v) => (set("make", v ?? ""), set("model", ""))} error={errors.make} />
            {models.length ? <SelectField label="Model" value={form.model || undefined} options={toOptions(models)} onChange={(v) => set("model", v ?? "")} error={errors.model} /> : <Input label="Model" value={form.model} onChangeText={(t) => set("model", t)} error={errors.model} />}
            <View className="flex-row gap-3">
              <View className="flex-1"><Input label="Year" value={form.year} onChangeText={(t) => set("year", t)} keyboardType="number-pad" maxLength={4} placeholder="2017" error={errors.year} /></View>
              <View className="flex-1"><Input label="Mileage (km)" value={form.mileage} onChangeText={(t) => set("mileage", t)} keyboardType="number-pad" placeholder="86000" error={errors.mileage} /></View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><Input label="Engine (cc)" value={form.engineCapacity} onChangeText={(t) => set("engineCapacity", t)} keyboardType="number-pad" placeholder="1500" error={errors.engineCapacity} /></View>
              <View className="flex-1"><Input label="Colour" value={form.color} onChangeText={(t) => set("color", t)} placeholder="Silver" error={errors.color} /></View>
            </View>
            {sel("transmission", "Transmission", TRANSMISSIONS, LABELS.transmission)}
            {sel("fuelType", "Fuel type", FUEL_TYPES, LABELS.fuelType)}
            {sel("bodyType", "Body type", BODY_TYPES, LABELS.bodyType)}
            {sel("driveType", "Drive", DRIVE_TYPES, LABELS.driveType)}
            {sel("condition", "Condition", CONDITIONS, LABELS.condition)}
            {sel("importStatus", "Import / local status", IMPORT_STATUSES, LABELS.importStatus)}
          </>
        )}

        {step === 3 && (
          <>
            <Input label="Price (KES)" value={form.price} onChangeText={(t) => set("price", t.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="1450000" error={errors.price} hint={form.price ? `KES ${Number(form.price).toLocaleString("en-KE")}` : undefined} />
            <View className="flex-row items-center justify-between rounded-md border border-border p-3">
              <Text className="text-base text-ink">Price is negotiable</Text>
              <Switch value={form.priceNegotiable} onValueChange={(v) => set("priceNegotiable", v)} trackColor={{ true: theme.accent }} accessibilityLabel="Price is negotiable" />
            </View>
            {sel("town", "Town", TOWN_NAMES)}
            <Input label="Area (optional)" value={form.area} onChangeText={(t) => set("area", t)} placeholder="e.g. Ngong Road" />
          </>
        )}

        {step === 4 && (
          <>
            <Input label="Description" value={form.description} onChangeText={(t) => set("description", t)} multiline textAlignVertical="top" className="h-40 py-2" error={errors.description} hint="Service history, accident history, anything a buyer should know. At least 30 characters." />
            <Text className="text-sm font-medium text-ink">Features</Text>
            <View className="flex-row flex-wrap gap-2">
              {COMMON_FEATURES.map((f) => {
                const on = form.features.includes(f);
                return <Chip key={f} label={f} selected={on} onPress={() => set("features", on ? form.features.filter((x) => x !== f) : [...form.features, f])} />;
              })}
            </View>
          </>
        )}

        {step === 5 && vehicle && (
          <>
            <VehicleCard vehicle={vehicle} />
            <Text className="text-sm text-ink-muted">{vehicle.images.length} photo(s) · {vehicle.description.length} characters of description</Text>
            <Text className="text-sm text-ink-muted">Our team reviews new listings, usually within a few hours. You&apos;ll get a notification as soon as it&apos;s live.</Text>
          </>
        )}

        {step === 6 && vehicle && (
          submitted ? (
            vehicle.status === "ACTIVE" ? (
              <View className="gap-4">
                <Text accessibilityRole="header" className="text-2xl font-extrabold text-ink">Your vehicle is listed! Share it with more buyers.</Text>
                <ShareActions vehicle={vehicle} sellerName={sellerName(profile.data, user?.name)} />
                <Button title="Done" variant="ghost" onPress={() => router.replace("/(seller)/vehicles")} />
              </View>
            ) : (
              <View className="gap-4">
                <Badge label="Pending review" tone="info" />
                <Text accessibilityRole="header" className="text-2xl font-extrabold text-ink">Submitted for review</Text>
                <Text className="text-ink-muted">We&apos;ll notify you when it&apos;s approved. Then share it to WhatsApp from My Vehicles.</Text>
                <Button title="Go to My Vehicles" onPress={() => router.replace("/(seller)/vehicles")} />
              </View>
            )
          ) : (
            <View className="gap-4">
              <Text className="text-xl font-bold text-ink">Ready to submit?</Text>
              <Text className="text-ink-muted">{vehicle.title} · {form.price ? `KES ${Number(form.price).toLocaleString("en-KE")}` : "no price yet"}</Text>
              <Button title="Submit listing" size="lg" icon="send" loading={busy} onPress={submit} />
            </View>
          )
        )}
      </ScrollView>

      {!submitted ? (
        <View className="flex-row gap-3 border-t border-border p-4">
          {step > 1 ? <Button title="Back" variant="outline" className="flex-1" onPress={() => setStep((s) => s - 1)} /> : null}
          {step < 6 ? <Button title={step === 5 ? "Continue" : "Save & continue"} className="flex-[2]" loading={busy} onPress={next} /> : null}
        </View>
      ) : null}
      {step === 1 && !vehicle ? (
        <Pressable className="items-center pb-3" onPress={next}><Text className="text-sm text-ink-muted">Add photos later</Text></Pressable>
      ) : null}
    </SafeAreaView>
  );
}
