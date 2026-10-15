import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { registerSchema, SELF_ASSIGNABLE_ROLES, type RegisterInput, type SelfAssignableRole } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ApiError, errorMessage, signIn } from "@/services/api";

export default function Register() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (SELF_ASSIGNABLE_ROLES as readonly string[]).includes(params.role ?? "") ? (params.role as SelfAssignableRole) : "BUYER";
  const { control, handleSubmit, setError, formState } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", phone: "", password: "", role } });

  async function onSubmit(values: RegisterInput) {
    try {
      await signIn("/auth/register", { ...values, phone: values.phone || undefined, role });
      router.replace(role === "BUYER" ? "/(auth)/profile-setup" : "/(auth)/broker-onboarding");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 422 || err.status === 409)) {
        const fields = err.fieldErrors();
        if (err.code === "EMAIL_TAKEN") fields.email = err.message;
        if (err.code === "PHONE_TAKEN") fields.phone = err.message;
        Object.entries(fields).forEach(([k, m]) => setError(k as keyof RegisterInput, { message: m }));
        if (!Object.keys(fields).length) setError("root", { message: err.message });
      } else setError("root", { message: errorMessage(err) });
    }
  }

  const field = (name: "name" | "email" | "phone" | "password", label: string, extra: Record<string, unknown> = {}) => (
    <Controller control={control} name={name} render={({ field: f, fieldState }) => <Input label={label} value={f.value ?? ""} onChangeText={f.onChange} onBlur={f.onBlur} error={fieldState.error?.message} {...extra} />} />
  );

  return (
    <Screen edges={["bottom"]}>
      <Title subtitle={role === "BUYER" ? "Save cars and request viewings." : "Your showroom is ready as soon as you sign up."}>{role === "DEALER" ? "Register your dealership" : role === "BROKER" ? "Create your broker account" : "Create your account"}</Title>
      <View className="gap-4">
        {field("name", role === "DEALER" ? "Dealership name" : role === "BROKER" ? "Name or business name" : "Full name", { autoComplete: "name" })}
        {field("email", "Email", { keyboardType: "email-address", autoCapitalize: "none", autoComplete: "email" })}
        {field("phone", role === "BUYER" ? "Phone (optional)" : "WhatsApp number", { keyboardType: "phone-pad", placeholder: "0712 345 678", autoComplete: "tel" })}
        {field("password", "Password", { secureTextEntry: true, autoComplete: "new-password", hint: "At least 8 characters with a letter and a number." })}
        {formState.errors.root ? <Text accessibilityRole="alert" className="text-sm text-danger">{formState.errors.root.message}</Text> : null}
        <Button title="Create account" size="lg" loading={formState.isSubmitting} onPress={handleSubmit(onSubmit)} />
        <Button title="I already have an account" variant="ghost" onPress={() => router.replace("/(auth)/login")} />
      </View>
    </Screen>
  );
}
