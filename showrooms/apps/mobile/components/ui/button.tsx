import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { theme } from "@/constants/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "whatsapp" | "danger";
const styles: Record<Variant, { box: string; text: string; icon: string }> = {
  primary: { box: "bg-accent active:bg-accent-hover", text: "text-white", icon: "#fff" },
  secondary: { box: "bg-ink active:opacity-90", text: "text-white", icon: "#fff" },
  outline: { box: "border border-border bg-white active:bg-surface", text: "text-ink", icon: theme.ink },
  ghost: { box: "active:bg-surface", text: "text-ink", icon: theme.ink },
  whatsapp: { box: "bg-whatsapp active:opacity-90", text: "text-white", icon: "#fff" },
  danger: { box: "bg-danger active:opacity-90", text: "text-white", icon: "#fff" },
};

export interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  size?: "md" | "lg" | "sm";
  className?: string;
}

/** 48dp minimum height on md/lg: comfortable thumb targets on Android. */
export function Button({ title, variant = "primary", icon, loading, size = "md", disabled, className = "", ...props }: ButtonProps) {
  const s = styles[variant];
  const height = size === "lg" ? "h-14" : size === "sm" ? "h-9 px-3" : "h-12";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center gap-2 rounded-md px-4 ${height} ${s.box} ${disabled ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {loading ? <ActivityIndicator color={s.icon} /> : icon ? <Ionicons name={icon} size={18} color={s.icon} /> : null}
      <Text className={`font-semibold ${size === "sm" ? "text-xs" : "text-base"} ${s.text}`}>{title}</Text>
    </Pressable>
  );
}
