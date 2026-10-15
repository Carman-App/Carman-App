import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import type { Inquiry, SellerAnalytics } from "@showrooms/shared";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Card, SectionHeader, Stat } from "@/components/ui/misc";
import { InquiryRow } from "@/features/inbox";
import { sellerName, useSellerProfile } from "@/features/seller/use-seller";
import { api, apiPaged } from "@/services/api";
import { useAuth } from "@/stores/auth";

export default function SellerDashboard() {
  const { user } = useAuth();
  const profile = useSellerProfile();
  const a = useQuery({ queryKey: ["analytics", 30], queryFn: () => api<SellerAnalytics>("/analytics/seller?days=30") });
  const leads = useQuery({ queryKey: ["leads", "recent"], queryFn: () => apiPaged<Inquiry[], { newCount: number }>("/broker/inquiries?limit=3") });
  const t = a.data?.totals;
  const l = a.data?.listings;
  const ent = profile.data?.entitlements;
  return (
    <Screen onRefresh={() => (a.refetch(), leads.refetch(), profile.refetch())} refreshing={a.isRefetching}>
      <View className="mb-4 mt-3">
        <Text className="text-sm text-ink-muted">Welcome back</Text>
        <Text accessibilityRole="header" className="text-2xl font-extrabold text-ink">{sellerName(profile.data, user?.name)}</Text>
      </View>
      {profile.data && profile.data.verificationStatus !== "VERIFIED" ? (
        <Pressable accessibilityRole="button" onPress={() => router.push("/verification")} className="mb-4 rounded-lg border border-info/20 bg-info-soft p-3">
          <Text className="text-sm text-ink"><Text className="font-semibold">Get verified.</Text> {profile.data.verificationStatus === "PENDING" ? "Your documents are being reviewed." : "Buyers trust verified sellers more. Tap to start."}</Text>
        </Pressable>
      ) : null}
      <Button title="Add a vehicle" icon="add-circle-outline" size="lg" onPress={() => router.push("/listing/new")} />
      <View className="mt-4 gap-3">
        <View className="flex-row gap-3">
          <Stat label="Active" value={l?.ACTIVE ?? "—"} hint={ent ? `of ${ent.listingLimit} on ${ent.planName}` : undefined} />
          <Stat label="Pending" value={l?.PENDING_REVIEW ?? "—"} />
          <Stat label="Sold" value={l?.SOLD ?? "—"} />
        </View>
        <View className="flex-row gap-3">
          <Stat label="Views (30d)" value={t?.views ?? "—"} />
          <Stat label="Inquiries" value={t ? t.viewingRequests + t.questions : "—"} />
        </View>
        <View className="flex-row gap-3">
          <Stat label="WhatsApp taps" value={t?.whatsappClicks ?? "—"} hint="Button taps, not confirmed chats" />
          <Stat label="Call taps" value={t?.callClicks ?? "—"} />
        </View>
      </View>
      <Button title="Listing performance" variant="outline" icon="bar-chart-outline" className="mt-3" onPress={() => router.push("/analytics")} />
      <View className="mt-6">
        <SectionHeader title={`Latest leads${leads.data?.meta.newCount ? ` (${leads.data.meta.newCount} new)` : ""}`} action="All leads" onAction={() => router.push("/(seller)/leads")} />
        {leads.data?.data.length ? <View className="gap-3">{leads.data.data.map((i) => <InquiryRow key={i.id} i={i} />)}</View> : <Card><Text className="text-sm text-ink-muted">No leads yet. Share your cars to WhatsApp to bring buyers in.</Text></Card>}
      </View>
    </Screen>
  );
}
