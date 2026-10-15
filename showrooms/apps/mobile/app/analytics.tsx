import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LABELS, type SellerAnalytics } from "@showrooms/shared";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Badge, Card, Chip, ErrorState, Loading, Stat } from "@/components/ui/misc";
import { api, errorMessage } from "@/services/api";

/** Lightweight bar chart: no chart library needed for a 7–30 bar daily series. */
function Bars({ data, field, color }: { data: NonNullable<SellerAnalytics["series"]>; field: "views" | "whatsappClicks"; color: string }) {
  const max = Math.max(1, ...data.map((d) => d[field]));
  return (
    <View accessibilityLabel={`Daily ${field}`} className="h-28 flex-row items-end gap-[2px]">
      {data.map((d) => <View key={d.date} className="flex-1 rounded-t-sm" style={{ height: `${(d[field] / max) * 100}%`, backgroundColor: color, minHeight: 2 }} />)}
    </View>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["analytics", days], queryFn: () => api<SellerAnalytics>(`/analytics/seller?days=${days}`) });
  const a = q.data;
  if (q.isLoading) return <Loading />;
  if (!a) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return (
    <Screen edges={["bottom"]} className="gap-4 pt-4" onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <View className="flex-row gap-2">{[7, 30, 90].map((d) => <Chip key={d} label={`${d} days`} selected={days === d} onPress={() => setDays(d)} />)}</View>
      <Text className="text-xs text-ink-muted">WhatsApp and call taps show buyer intent. They are not confirmed conversations or sales.</Text>
      <View className="flex-row gap-3"><Stat label="Views" value={a.totals.views} /><Stat label="WhatsApp taps" value={a.totals.whatsappClicks} /></View>
      <View className="flex-row gap-3"><Stat label="Call taps" value={a.totals.callClicks} /><Stat label="Viewing requests" value={a.totals.viewingRequests} /></View>
      {a.series ? (
        <Card className="gap-3">
          <Text className="font-semibold">Daily views</Text>
          <Bars data={a.series} field="views" color="#1C1F23" />
          <Text className="font-semibold">Daily WhatsApp taps</Text>
          <Bars data={a.series} field="whatsappClicks" color="#1FA855" />
        </Card>
      ) : (
        <Card className="gap-2 bg-accent-soft"><Text className="text-sm text-ink">Daily trends are part of Pro.</Text><Button title="See plans" size="sm" onPress={() => router.push("/subscription")} /></Card>
      )}
      <Text className="text-lg font-bold">Per listing</Text>
      {a.perVehicle?.map((v, i) => (
        <Pressable key={v.id} onPress={() => router.push(`/listing/${v.id}`)} className="gap-1 rounded-lg border border-border p-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="flex-1 font-semibold">{v.title}</Text>
            {i < 3 && v.views > 0 ? <Badge label="Top" tone="accent" /> : null}
          </View>
          <Text className="text-xs text-ink-muted">{LABELS.status[v.status]} · {v.views} views · {v.whatsappClicks} WhatsApp · {v.callClicks} calls · {v.inquiries} inquiries</Text>
        </Pressable>
      ))}
    </Screen>
  );
}
