import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export function Screen({ children, scroll = true, edges = ["top"], refreshing, onRefresh, className = "", footer }: { children: React.ReactNode; scroll?: boolean; edges?: Edge[]; refreshing?: boolean; onRefresh?: () => void; className?: string; footer?: React.ReactNode }) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-white">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName={`px-4 pb-10 ${className}`}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.accent} /> : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <View className={`flex-1 ${className}`}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View className="mb-5 mt-2 gap-1">
      <Text accessibilityRole="header" className="text-2xl font-extrabold text-ink">
        {children}
      </Text>
      {subtitle ? <Text className="text-sm text-ink-muted">{subtitle}</Text> : null}
    </View>
  );
}
