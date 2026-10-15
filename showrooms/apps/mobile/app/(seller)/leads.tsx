import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, ScrollView, View } from "react-native";
import { INQUIRY_STATUSES, whatsappLink, type Inquiry, type InquiryStatus } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, ErrorState, Loading } from "@/components/ui/misc";
import { INQUIRY_STATUS_LABEL, InquiryRow } from "@/features/inbox";
import { api, ApiError, apiPaged, errorMessage } from "@/services/api";

export default function Leads() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<InquiryStatus | "">("");
  const q = useQuery({ queryKey: ["leads", status], queryFn: () => apiPaged<Inquiry[]>(`/broker/inquiries?limit=50${status ? `&status=${status}` : ""}`) });

  async function update(i: Inquiry, next: InquiryStatus) {
    try {
      await api(`/broker/inquiries/${i.id}`, { method: "PATCH", body: { status: next } });
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) Alert.alert("Lead tracking is a Pro feature", err.message, [{ text: "Not now" }, { text: "See plans", onPress: () => router.push("/subscription") }]);
      else Alert.alert("Couldn't update", errorMessage(err));
    }
  }

  return (
    <Screen onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Title subtitle="Viewing requests and questions from buyers.">Leads</Title>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3">
        <Chip label="All" selected={!status} onPress={() => setStatus("")} />
        {INQUIRY_STATUSES.map((s) => <Chip key={s} label={INQUIRY_STATUS_LABEL[s]} selected={status === s} onPress={() => setStatus(s)} />)}
      </ScrollView>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : q.data?.data.length ? (
        <View className="gap-3">
          {q.data.data.map((i) => (
            <InquiryRow key={i.id} i={i}>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {i.buyer?.phone ? <Button title="WhatsApp" size="sm" variant="whatsapp" icon="logo-whatsapp" onPress={() => Linking.openURL(whatsappLink(i.buyer!.phone!, `Hi ${i.buyer!.name.split(" ")[0]}, thanks for your interest in the ${i.vehicle?.title ?? "car"}.`))} /> : null}
                {i.buyer?.phone ? <Button title="Call" size="sm" variant="outline" icon="call-outline" onPress={() => Linking.openURL(`tel:${i.buyer!.phone}`)} /> : null}
                {i.status !== "SCHEDULED" ? <Button title="Scheduled" size="sm" variant="outline" onPress={() => update(i, "SCHEDULED")} /> : null}
                {i.status !== "CLOSED" ? <Button title="Close" size="sm" variant="ghost" onPress={() => update(i, "CLOSED")} /> : null}
              </View>
            </InquiryRow>
          ))}
        </View>
      ) : (
        <EmptyState title="No leads yet" description="Buyers' viewing requests and questions appear here, with a notification." icon="chatbubbles-outline" />
      )}
    </Screen>
  );
}
