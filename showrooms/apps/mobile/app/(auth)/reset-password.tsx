import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { resetPasswordSchema } from "@showrooms/shared";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { api, errorMessage } from "@/services/api";

/** Opened from the email link (showrooms://reset-password?token=...) or by pasting the token. */
export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit() {
    const parsed = resetPasswordSchema.safeParse({ token: token.trim(), password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setBusy(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: parsed.data });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen edges={["bottom"]}>
      <Title>Choose a new password</Title>
      {done ? (
        <View className="gap-4">
          <Text className="rounded-md bg-success-soft p-4 text-sm text-success">Password saved. You&apos;ve been signed out on other devices.</Text>
          <Button title="Log in" onPress={() => router.replace("/(auth)/login")} />
        </View>
      ) : (
        <View className="gap-4">
          {!params.token ? <Input label="Reset code" value={token} onChangeText={setToken} autoCapitalize="none" hint="Paste the code from the reset link in your email." /> : null}
          <Input label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={error} />
          <Button title="Save password" loading={busy} onPress={submit} />
        </View>
      )}
    </Screen>
  );
}
