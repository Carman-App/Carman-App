import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { theme } from "@/constants/theme";
import { Button } from "./button";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info" | "dark" }) {
  const map = {
    neutral: "bg-surface text-ink-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    dark: "bg-ink text-white",
  } as const;
  const [bg, fg] = map[tone].split(" ");
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${bg}`}>
      <Text className={`text-xs font-semibold ${fg}`}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} className={`rounded-full border px-3.5 py-2 ${selected ? "border-accent bg-accent-soft" : "border-border bg-white"}`}>
      <Text className={`text-sm font-medium ${selected ? "text-accent" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-lg border border-border bg-white p-4 ${className}`}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text accessibilityRole="header" className="text-lg font-bold text-ink">
        {title}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-sm font-semibold text-accent">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <View className="flex-1 rounded-lg border border-border bg-white p-3">
      <Text className="text-[11px] font-medium uppercase text-ink-muted">{label}</Text>
      <Text className="mt-1 text-xl font-bold text-ink">{value}</Text>
      {hint ? <Text className="mt-0.5 text-[11px] text-ink-subtle">{hint}</Text> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator color={theme.accent} size="large" />
    </View>
  );
}

export function EmptyState({ title, description, actionTitle, onAction, icon = "file-tray-outline" }: { title: string; description?: string; actionTitle?: string; onAction?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View className="items-center gap-3 px-6 py-14">
      <View className="rounded-full bg-surface p-4">
        <Ionicons name={icon} size={28} color={theme.inkMuted} />
      </View>
      <Text className="text-center text-base font-semibold text-ink">{title}</Text>
      {description ? <Text className="text-center text-sm text-ink-muted">{description}</Text> : null}
      {actionTitle ? <Button title={actionTitle} onPress={onAction} className="mt-2" /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" className="items-center gap-3 px-6 py-12">
      <Ionicons name="cloud-offline-outline" size={32} color={theme.danger} />
      <Text className="text-center text-sm text-ink">{message}</Text>
      {onRetry ? <Button title="Try again" variant="outline" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

export function SkeletonBox({ className = "" }: { className?: string }) {
  return <View className={`rounded-md bg-surface ${className}`} />;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }} className="h-1.5 overflow-hidden rounded-full bg-surface">
      <View className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </View>
  );
}

export function SafetyNotice() {
  return (
    <View accessibilityLabel="Buyer safety" className="flex-row gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4">
      <Ionicons name="shield-outline" size={20} color={theme.warning} />
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-ink">Always inspect and verify a vehicle before making payment.</Text>
        <Text className="text-sm text-ink-muted">Check the logbook against the seller&apos;s ID and run an NTSA search before paying anything.</Text>
      </View>
    </View>
  );
}
