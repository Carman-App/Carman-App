import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import { loginSchema, type LoginInput } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { errorMessage, signIn } from "@/services/api";

export default function Login() {
  const { control, handleSubmit, setError, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    try {
      const session = await signIn("/auth/login", values);
      router.replace(session.user.role === "BROKER" || session.user.role === "DEALER" ? "/(seller)/dashboard" : "/(buyer)/home");
    } catch (err) {
      setError("root", { message: errorMessage(err) });
    }
  }

  return (
    <Screen edges={["bottom"]}>
      <Title subtitle="Log in to your Showrooms account.">Welcome back</Title>
      <View className="gap-4">
        <Controller control={control} name="email" render={({ field, fieldState }) => <Input label="Email" value={field.value} onChangeText={field.onChange} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={fieldState.error?.message} />} />
        <Controller control={control} name="password" render={({ field, fieldState }) => <Input label="Password" value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete="current-password" error={fieldState.error?.message} />} />
        {formState.errors.root ? <Text accessibilityRole="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{formState.errors.root.message}</Text> : null}
        <Button title="Log in" size="lg" loading={formState.isSubmitting} onPress={handleSubmit(onSubmit)} />
        <Button title="Forgot password?" variant="ghost" onPress={() => router.push("/(auth)/forgot-password")} />
        <Button title="Create an account" variant="outline" onPress={() => router.push("/(auth)/role-selection")} />
      </View>
    </Screen>
  );
}
