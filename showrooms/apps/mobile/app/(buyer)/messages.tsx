import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import type { Inquiry } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Chip, EmptyState, Loading } from "@/components/ui/misc";
import { InquiryRow, NotificationList } from "@/features/inbox";
import { apiPaged } from "@/services/api";
import { useAuth } from "@/stores/auth";

/** Conversations happen on WhatsApp; this tab tracks viewing requests, questions and updates. */
export default function Messages() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"inquiries" | "updates">("inquiries");
  const q = useQuery({ queryKey: ["inquiries", "me", user?.id], queryFn: () => apiPaged<Inquiry[]>("/inquiries/me?limit=50"), enabled: !!user });
  if (!user) return <Screen><Title>Messages</Title><EmptyState title="Track your viewing requests" description="Log in to see replies and updates from sellers." actionTitle="Log in" onAction={() => router.push("/(auth)/login")} icon="chatbubbles-outline" /></Screen>;
  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Chats with sellers happen on WhatsApp. Your requests and updates are here.">Messages</Title>
      <View className="mb-4 flex-row gap-2">
        <Chip label="My requests" selected={tab === "inquiries"} onPress={() => setTab("inquiries")} />
        <Chip label="Updates" selected={tab === "updates"} onPress={() => setTab("updates")} />
      </View>
      {tab === "updates" ? <NotificationList /> : q.isLoading ? <Loading /> : q.data?.data.length ? <View className="gap-3">{q.data.data.map((i) => <InquiryRow key={i.id} i={i} />)}</View> : <EmptyState title="No requests yet" description="Request a viewing from any listing." icon="calendar-outline" />}
    </Screen>
  );
}
