import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/constants/theme";

export function FieldLabel({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink">{label}</Text>
      {children}
      {error ? (
        <Text accessibilityRole="alert" className="text-xs font-medium text-danger">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-xs text-ink-muted">{hint}</Text>
      ) : null}
    </View>
  );
}

export const Input = forwardRef<TextInput, TextInputProps & { label: string; error?: string; hint?: string }>(function Input({ label, error, hint, className = "", ...props }, ref) {
  return (
    <FieldLabel label={label} error={error} hint={hint}>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={theme.inkSubtle}
        className={`h-12 rounded-md border bg-white px-3 text-base text-ink ${error ? "border-danger" : "border-border"} ${className}`}
        {...props}
      />
    </FieldLabel>
  );
});

export interface Option {
  value: string;
  label: string;
}

/** Bottom-sheet picker: consistent on Android and iOS, searchable lists stay thumb-friendly. */
export function SelectField({ label, value, options, onChange, placeholder = "Select…", error, allowClear }: { label: string; value?: string; options: Option[]; onChange: (v: string | undefined) => void; placeholder?: string; error?: string; allowClear?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <FieldLabel label={label} error={error}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? placeholder}`} onPress={() => setOpen(true)} className={`h-12 flex-row items-center justify-between rounded-md border bg-white px-3 ${error ? "border-danger" : "border-border"}`}>
        <Text className={current ? "text-base text-ink" : "text-base text-ink-subtle"}>{current?.label ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={theme.inkMuted} />
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <SafeAreaView edges={["bottom"]} className="max-h-[70%] rounded-t-xl bg-white">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text className="text-base font-semibold">{label}</Text>
            {allowClear && value ? (
              <Pressable onPress={() => (onChange(undefined), setOpen(false))}>
                <Text className="font-semibold text-accent">Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={() => (onChange(item.value), setOpen(false))} className="flex-row items-center justify-between px-4 py-3.5 active:bg-surface">
                <Text className="text-base text-ink">{item.label}</Text>
                {item.value === value ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </FieldLabel>
  );
}

export const toOptions = (values: readonly string[], labels?: Record<string, string>): Option[] => values.map((v) => ({ value: v, label: labels?.[v] ?? v }));
