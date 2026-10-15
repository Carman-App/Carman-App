import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { formatKes, type Inquiry, type Notification } from "@showrooms/shared";
import { Badge, EmptyState } from "@/components/ui/misc";
import { api, apiPaged } from "@/services/api";

export const INQUIRY_STATUS_LABEL = { NEW: "New", CONTACTED: "Contacted", SCHEDULED: "Viewing scheduled", CLOSED: "Closed", SPAM: "Spam" } as const;

export function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export function NotificationList({ limit = 30 }: { limit?: number }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications", limit], queryFn: () => apiPaged<Notification[], { unread: number }>(`/notifications?limit=${limit}`) });
  if (!q.data?.data.length) return <EmptyState title="You're all caught up" icon="notifications-outline" />;
  return (
    <View className="overflow-hidden rounded-lg border border-border">
      {q.data.data.map((n) => (
        <Pressable
          key={n.id}
          accessibilityRole="button"
          onPress={async () => {
            if (!n.readAt) await api(`/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => undefined);
            qc.invalidateQueries({ queryKey: ["notifications"] });
            if (n.data?.slug) router.push(`/vehicle/${n.data.slug}`);
            else if (n.data?.vehicleId && n.data.screen === "my-vehicles") router.push(`/listing/${n.data.vehicleId}`);
          }}
          className={`gap-0.5 border-b border-border p-4 ${n.readAt ? "" : "bg-accent-soft/60"}`}
        >
          <Text className="font-semibold text-ink">{n.title}</Text>
          <Text className="text-sm text-ink-muted">{n.body}</Text>
          <Text className="text-xs text-ink-subtle">{timeAgo(n.createdAt)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function InquiryRow({ i, children }: { i: Inquiry; children?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => i.vehicle && router.push(`/vehicle/${i.vehicle.slug}`)} className="gap-1.5 rounded-lg border border-border p-4">
      <View className="flex-row flex-wrap gap-1.5">
        <Badge label={i.type === "VIEWING_REQUEST" ? "Viewing request" : "Question"} tone={i.type === "VIEWING_REQUEST" ? "accent" : "info"} />
        <Badge label={INQUIRY_STATUS_LABEL[i.status]} tone={i.status === "NEW" ? "warning" : "neutral"} />
      </View>
      {i.vehicle ? <Text className="font-semibold text-ink">{i.vehicle.title} · <Text className="text-accent">{formatKes(i.vehicle.price)}</Text></Text> : null}
      {i.buyer ? <Text className="text-sm text-ink">{i.buyer.name}{i.buyer.phone ? ` · ${i.buyer.phone}` : ""}</Text> : null}
      {i.preferredDate ? <Text className="text-sm text-ink-muted">Preferred: {new Date(i.preferredDate).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</Text> : null}
      {i.message ? <Text className="text-sm text-ink-muted">“{i.message}”</Text> : null}
      <Text className="text-xs text-ink-subtle">{timeAgo(i.createdAt)}</Text>
      {children}
    </Pressable>
  );
}
