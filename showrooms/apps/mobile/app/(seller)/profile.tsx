import { router } from "expo-router";
import { Linking } from "react-native";
import { Screen, Title } from "@/components/layout/screen";
import { Badge } from "@/components/ui/misc";
import { SITE_URL } from "@/constants/config";
import { AccountHeader, MenuItem, SignOutButton } from "@/features/account-menu";
import { useSellerProfile } from "@/features/seller/use-seller";
import { useAuth } from "@/stores/auth";

export default function SellerProfile() {
  const { user } = useAuth();
  const p = useSellerProfile();
  const kind = user?.role === "DEALER" ? "dealers" : "brokers";
  return (
    <Screen>
      <Title>Profile</Title>
      <AccountHeader />
      {p.data ? <Badge label={`${p.data.entitlements.planName} plan · ${p.data.verificationStatus.replace("_", " ").toLowerCase()}`} tone="accent" /> : null}
      <MenuItem icon="storefront-outline" label="View my showroom" onPress={() => p.data && router.push(`/showroom/${kind}/${p.data.slug}`)} />
      <MenuItem icon="create-outline" label="Edit showroom details" onPress={() => router.push("/(auth)/broker-onboarding")} />
      <MenuItem icon="shield-checkmark-outline" label="Verification" onPress={() => router.push("/verification")} />
      <MenuItem icon="bar-chart-outline" label="Analytics" onPress={() => router.push("/analytics")} />
      <MenuItem icon="diamond-outline" label="Plans & billing" onPress={() => router.push("/subscription")} />
      <MenuItem icon="notifications-outline" label="Notifications" onPress={() => router.push("/notifications")} />
      <MenuItem icon="search-outline" label="Browse the marketplace" onPress={() => router.push("/(buyer)/home")} />
      {user?.role === "DEALER" ? <MenuItem icon="people-outline" label="Team (manage on the web)" onPress={() => Linking.openURL(`${SITE_URL}/dashboard/team`)} /> : null}
      <SignOutButton />
    </Screen>
  );
}
