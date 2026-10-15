import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { forgotPasswordSchema } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { api, errorMessage } from "@/services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setBusy(true);
    try {
      await api("/auth/forgot-password", { method: "POST", body: parsed.data });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen edges={["bottom"]}>
      <Title subtitle="We'll email you a link to set a new password.">Reset your password</Title>
      {sent ? (
        <View className="gap-4">
          <Text className="rounded-md bg-success-soft p-4 text-sm text-success">If an account exists for that email, a reset link is on its way. It expires in 30 minutes.</Text>
          <Button title="I have a reset code" variant="outline" onPress={() => router.push("/(auth)/reset-password")} />
        </View>
      ) : (
        <View className="gap-4">
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={error} />
          <Button title="Send reset link" loading={busy} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}
