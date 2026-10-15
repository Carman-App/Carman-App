import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, FlatList, Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatEngine, formatKes, formatMileage, imageUrl, label, REPORT_REASON_LABELS, REPORT_REASONS, VERIFICATION_EXPLAINER, type ReportReason, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, Chip, ErrorState, Loading, SafetyNotice } from "@/components/ui/misc";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { VehicleCard } from "@/components/vehicles/vehicle-card";
import { listingUrl } from "@/constants/config";
import { theme } from "@/constants/theme";
import { api, errorMessage } from "@/services/api";
import { shareSheet, whatsappSeller } from "@/services/share";
import { useAuth } from "@/stores/auth";

const W = Dimensions.get("window").width;
const track = (id: string, path: "view" | "contact", body: object = {}) => api(`/vehicles/${id}/${path}`, { method: "POST", body }).catch(() => undefined);

function Gallery({ v }: { v: Vehicle }) {
  const [index, setIndex] = useState(0);
  return (
    <View>
      <FlatList
        data={v.images}
        horizontal
        pagingEnabled
        keyExtractor={(i) => i.publicId}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item, index: i }) => <Image accessibilityLabel={`${v.title} photo ${i + 1}`} source={{ uri: imageUrl(item.url, { width: 1080 }) }} style={{ width: W, height: W * 0.75 }} contentFit="cover" transition={150} />}
        ListEmptyComponent={<View style={{ width: W, height: W * 0.75 }} className="items-center justify-center bg-surface"><Text className="text-ink-subtle">No photos</Text></View>}
      />
      {v.images.length > 1 ? <Text className="absolute bottom-3 right-3 overflow-hidden rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white">{index + 1} / {v.images.length}</Text> : null}
      {v.videos[0] ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Play video" onPress={() => Linking.openURL(v.videos[0]!.url)} className="absolute bottom-3 left-3 flex-row items-center gap-1 rounded-full bg-ink/80 px-3 py-1.5">
          <Ionicons name="play" size={14} color="#fff" />
          <Text className="text-xs font-semibold text-white">Video</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ViewingSheet({ v, open, onClose }: { v: Vehicle; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [message, setMessage] = useState("");
  const [day, setDay] = useState(1);
  const [busy, setBusy] = useState(false);
  const [days] = useState(() => [1, 2, 3, 4, 5, 6, 7].map((d) => new Date(Date.now() + d * 86_400_000)));
  async function submit() {
    setBusy(true);
    try {
      const date = days[day - 1]!;
      date.setHours(10, 0, 0, 0);
      await api(`/vehicles/${v.id}/inquiries`, { method: "POST", body: { type: "VIEWING_REQUEST", phone: phone || undefined, message, preferredDate: date.toISOString() } });
      onClose();
      Alert.alert("Viewing requested", "The seller has been notified and will contact you.");
    } catch (err) {
      Alert.alert("Couldn't send", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <SafeAreaView edges={["bottom"]} className="gap-4 rounded-t-xl bg-white p-4">
        <Text className="text-lg font-bold">Request a viewing</Text>
        <Text className="text-sm font-medium">Preferred day</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {days.map((d, i) => <Chip key={i} label={d.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })} selected={day === i + 1} onPress={() => setDay(i + 1)} />)}
        </ScrollView>
        <Input label="Your phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" hint="The seller will call or WhatsApp you on this number." />
        <Input label="Message (optional)" value={message} onChangeText={setMessage} placeholder="Can I bring a mechanic?" />
        <Button title="Send request" loading={busy} onPress={submit} />
      </SafeAreaView>
    </Modal>
  );
}

function ReportSheet({ v, open, onClose }: { v: Vehicle; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>("SCAM");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await api(`/vehicles/${v.id}/reports`, { method: "POST", body: { reason, details } });
      onClose();
      Alert.alert("Report sent", "Thank you. Our team will review this listing.");
    } catch (err) {
      Alert.alert("Couldn't send", errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <SafeAreaView edges={["bottom"]} className="gap-3 rounded-t-xl bg-white p-4">
        <Text className="text-lg font-bold">Report this listing</Text>
        <View className="flex-row flex-wrap gap-2">{REPORT_REASONS.map((r) => <Chip key={r} label={REPORT_REASON_LABELS[r]} selected={reason === r} onPress={() => setReason(r)} />)}</View>
        <Input label="Details" value={details} onChangeText={setDetails} multiline className="h-20 py-2" />
        <Button title="Send report" variant="danger" loading={busy} onPress={submit} />
      </SafeAreaView>
    </Modal>
  );
}

export default function VehicleDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["vehicle", slug, user?.id], queryFn: () => api<Vehicle>(`/vehicles/${slug}`) });
  const similar = useQuery({ queryKey: ["similar", slug], queryFn: () => api<Vehicle[]>(`/vehicles/${slug}/similar`), enabled: !!q.data });
  const [viewing, setViewing] = useState(false);
  const [report, setReport] = useState(false);
  const tracked = useRef(false);
  const v = q.data;

  useEffect(() => {
    if (v && !tracked.current) {
      tracked.current = true;
      track(v.id, "view");
    }
  }, [v]);

  const needLogin = (fn: () => void) => () => (user ? fn() : router.push("/(auth)/login"));
  if (q.isLoading) return <Loading />;
  if (!v) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const specs: [string, string][] = [
    ["Year", String(v.year)],
    ["Mileage", formatMileage(v.mileage)],
    ["Transmission", label("transmission", v.transmission)],
    ["Fuel", label("fuelType", v.fuelType)],
    ["Engine", formatEngine(v.engineCapacity)],
    ["Body", label("bodyType", v.bodyType)],
    ["Drive", label("driveType", v.driveType)],
    ["Colour", v.color],
    ["Condition", label("condition", v.condition)],
    ["Availability", label("importStatus", v.importStatus)],
  ];
  const live = v.status === "ACTIVE";
  const phone = v.seller?.phone ?? v.seller?.whatsappNumber;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <View className="flex-row items-center gap-2">
              <Pressable accessibilityLabel="Share listing" onPress={() => shareSheet(`${v.title} — ${formatKes(v.price)}\n${listingUrl(v.slug)}`, listingUrl(v.slug))} hitSlop={8}><Ionicons name="share-social-outline" size={22} color={theme.ink} /></Pressable>
              <FavoriteButton vehicleId={v.id} size={22} />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerClassName="pb-32">
        <Gallery v={v} />
        <View className="gap-4 p-4">
          <View className="flex-row flex-wrap gap-1.5">
            {v.status === "SOLD" ? <Badge label="Sold" tone="danger" /> : null}
            {v.isVerified ? <Badge label="Verified listing" tone="success" /> : null}
            {v.isFeatured ? <Badge label="Featured" tone="dark" /> : null}
          </View>
          <Text accessibilityRole="header" className="text-2xl font-extrabold text-ink">{v.title}</Text>
          <View>
            <Text className="text-3xl font-extrabold text-accent">{formatKes(v.price)}</Text>
            {v.priceNegotiable ? <Text className="text-sm text-ink-muted">Negotiable</Text> : null}
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={16} color={theme.inkMuted} />
            <Text className="text-ink-muted">{[v.location.area, v.location.town].filter(Boolean).join(", ")}</Text>
          </View>

          {live ? <Button title="Request viewing" variant="secondary" icon="calendar-outline" onPress={needLogin(() => setViewing(true))} /> : null}

          <View className="flex-row flex-wrap overflow-hidden rounded-lg border border-border">
            {specs.map(([k, val]) => (
              <View key={k} className="w-1/2 border-b border-r border-border p-3">
                <Text className="text-xs text-ink-muted">{k}</Text>
                <Text className="mt-0.5 font-semibold text-ink">{val}</Text>
              </View>
            ))}
          </View>

          <View className="gap-2">
            <Text className="text-lg font-bold">Description</Text>
            <Text className="leading-6 text-ink-muted">{v.description}</Text>
            {v.features.length ? <View className="mt-1 flex-row flex-wrap gap-2">{v.features.map((f) => <Badge key={f} label={f} />)}</View> : null}
          </View>

          {v.seller ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/showroom/${v.seller!.type === "DEALER" ? "dealers" : "brokers"}/${v.seller!.slug}`)} className="gap-2 rounded-lg border border-border p-4">
              <Text className="text-xs font-semibold uppercase text-ink-muted">{v.seller.type === "DEALER" ? "Dealer" : "Broker"}</Text>
              <View className="flex-row items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-ink"><Text className="text-lg font-bold text-white">{v.seller.name[0]}</Text></View>
                <View className="flex-1">
                  <Text className="font-semibold text-ink">{v.seller.name}</Text>
                  <Text className="text-sm text-ink-muted">{v.seller.town}{v.seller.ratingCount ? ` · ★ ${v.seller.ratingAvg.toFixed(1)} (${v.seller.ratingCount})` : ""}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.inkSubtle} />
              </View>
              {v.seller.isVerified ? <Badge label="Verified seller" tone="info" /> : <Badge label="Not verified yet" />}
              <Text className="text-xs text-ink-subtle">{v.seller.isVerified ? VERIFICATION_EXPLAINER.broker : "Take extra care with unverified sellers."}</Text>
            </Pressable>
          ) : null}

          <SafetyNotice />
          {live ? <Button title="Report listing" variant="ghost" icon="flag-outline" onPress={needLogin(() => setReport(true))} /> : null}

          {similar.data?.length ? (
            <View className="gap-3">
              <Text className="text-lg font-bold">Similar vehicles</Text>
              <FlatList horizontal data={similar.data} keyExtractor={(s) => s.id} renderItem={({ item }) => <VehicleCard vehicle={item} horizontal />} ItemSeparatorComponent={() => <View className="w-3" />} showsHorizontalScrollIndicator={false} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* WhatsApp and Call stay in thumb reach. */}
      {live && phone ? (
        <SafeAreaView edges={["bottom"]} className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-border bg-white px-4 pt-3">
          <Button title="WhatsApp" variant="whatsapp" icon="logo-whatsapp" size="lg" className="flex-1" onPress={() => { track(v.id, "contact", { channel: "WHATSAPP" }); whatsappSeller(v); }} />
          <Button title="Call" variant="outline" icon="call-outline" size="lg" className="flex-1" onPress={() => { track(v.id, "contact", { channel: "CALL" }); Linking.openURL(`tel:${phone}`); }} />
        </SafeAreaView>
      ) : null}
      <ViewingSheet v={v} open={viewing} onClose={() => setViewing(false)} />
      <ReportSheet v={v} open={report} onClose={() => setReport(false)} />
    </View>
  );
}
