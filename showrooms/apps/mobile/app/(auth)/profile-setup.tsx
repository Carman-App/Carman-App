import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { TOWN_NAMES, type PublicUser } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input, SelectField, toOptions } from "@/components/ui/field";
import { api, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";
import { useFilters } from "@/stores/filters";

/** Buyer profile setup: a phone for sellers to reach them, and a home town for nearby cars. */
export default function ProfileSetup() {
  const { user, setUser } = useAuth();
  const setFilters = useFilters((s) => s.set);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [town, setTown] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      if (phone && phone !== user?.phone) setUser(await api<PublicUser>("/users/me", { method: "PATCH", body: { phone } }));
      if (town) setFilters({ town: town as (typeof TOWN_NAMES)[number] });
      router.replace("/(buyer)/home");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen edges={["bottom"]}>
      <Title subtitle="Optional — you can change these any time.">Almost done</Title>
      <View className="gap-4">
        <Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712 345 678" hint="Sellers use this to confirm viewings." error={error} />
        <SelectField label="Where are you looking?" value={town} options={toOptions(TOWN_NAMES)} onChange={setTown} placeholder="All of Kenya" allowClear />
        <Button title="Start browsing" size="lg" loading={busy} onPress={save} />
        <Button title="Skip" variant="ghost" onPress={() => router.replace("/(buyer)/home")} />
      </View>
    </Screen>
  );
}
