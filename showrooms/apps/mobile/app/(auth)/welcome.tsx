import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";

export default function Welcome() {
  const done = async (to: "/(auth)/role-selection" | "/(auth)/login" | "/(buyer)/home") => {
    await AsyncStorage.setItem("showrooms.welcomeSeen", "1");
    router.replace(to);
  };
  return (
    <SafeAreaView className="flex-1 bg-ink">
      <View className="flex-1 justify-end gap-4 px-6 pb-6">
        <View className="mb-auto mt-10 h-14 w-14 items-center justify-center rounded-xl bg-accent">
          <Text className="text-2xl font-extrabold text-white">S</Text>
        </View>
        <Text accessibilityRole="header" className="text-4xl font-extrabold leading-tight text-white">
          Find your next car.
        </Text>
        <Text className="text-base text-white/75">Vehicles from brokers, dealers and sellers across Kenya — prices in KES, contact sellers on WhatsApp.</Text>
        <Button title="Get started" size="lg" onPress={() => done("/(auth)/role-selection")} className="mt-4" />
        <Button title="I already have an account" variant="outline" size="lg" onPress={() => done("/(auth)/login")} />
        <Button title="Browse without an account" variant="ghost" onPress={() => done("/(buyer)/home")} className="bg-transparent" />
      </View>
    </SafeAreaView>
  );
}
