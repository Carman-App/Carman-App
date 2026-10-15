import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { TOWN_NAMES } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input, SelectField, toOptions } from "@/components/ui/field";
import { Card, Loading } from "@/components/ui/misc";
import { api, errorMessage } from "@/services/api";
import { useAuth } from "@/stores/auth";

/** First-run showroom setup for brokers and dealers. */
export default function BrokerOnboarding() {
  const { user } = useAuth();
  const dealer = user?.role === "DEALER";
  const path = dealer ? "/dealers/me" : "/brokers/me";
  const profile = useQuery({ queryKey: ["seller-profile", user?.id, "raw"], queryFn: () => api<Record<string, unknown>>(path), enabled: !!user });
  if (!profile.data) return <Loading />;
  return <OnboardingForm path={path} dealer={dealer} initial={profile.data} />;
}

function OnboardingForm({ path, dealer, initial }: { path: string; dealer: boolean; initial: Record<string, unknown> }) {
  const qc = useQueryClient();
  const str = (k: string) => (initial[k] === undefined || initial[k] === null ? "" : String(initial[k]));
  const [name, setName] = useState(str(dealer ? "businessName" : "displayName"));
  const [whatsapp, setWhatsapp] = useState(str("whatsappNumber"));
  const [town, setTown] = useState<string | undefined>(str("town") || undefined);
  const [about, setAbout] = useState(str(dealer ? "description" : "bio"));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await api(path, { method: "PATCH", body: { [dealer ? "businessName" : "displayName"]: name, whatsappNumber: whatsapp || undefined, town, [dealer ? "description" : "bio"]: about || undefined } });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
      router.replace("/(seller)/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen edges={["bottom"]}>
      <Title subtitle="Buyers see this on your showroom page and every listing.">Set up your showroom</Title>
      <View className="gap-4">
        <Input label={dealer ? "Dealership name" : "Showroom name"} value={name} onChangeText={setName} />
        <Input label="WhatsApp number" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" hint="The WhatsApp button on your listings opens a chat with this number." />
        <SelectField label="Town" value={town} options={toOptions(TOWN_NAMES)} onChange={setTown} />
        <Input label="About (optional)" value={about} onChangeText={setAbout} multiline className="h-24 py-2" placeholder="Japanese imports, viewing on Ngong Road…" />
        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
        <Button title="Save and continue" size="lg" loading={busy} onPress={save} />
        <Card className="bg-surface">
          <Text className="text-sm text-ink-muted">Next: add your first car. Listings are reviewed by our team, then you can share them to WhatsApp chats, groups and your Status.</Text>
        </Card>
      </View>
    </Screen>
  );
}
