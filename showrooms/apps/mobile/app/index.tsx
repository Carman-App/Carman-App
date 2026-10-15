import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Loading } from "@/components/ui/misc";
import { isSeller, useAuth } from "@/stores/auth";

export const WELCOME_SEEN_KEY = "showrooms.welcomeSeen";

/** Sends people to the right home: welcome once, then buyer tabs or the seller dashboard. */
export default function Index() {
  const { status, user } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SEEN_KEY).then((v) => setSeen(v === "1"));
  }, []);

  if (status === "loading" || seen === null) return <Loading />;
  if (user && isSeller(user)) return <Redirect href="/(seller)/dashboard" />;
  if (user) return <Redirect href="/(buyer)/home" />;
  return <Redirect href={seen ? "/(buyer)/home" : "/(auth)/welcome"} />;
}
