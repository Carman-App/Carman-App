import { router } from "expo-router";
import { Linking } from "react-native";
import { Screen, Title } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { SITE_URL } from "@/constants/config";
import { AccountHeader, MenuItem, SignOutButton } from "@/features/account-menu";
import { isSeller, useAuth } from "@/stores/auth";

export default function BuyerProfile() {
  const { user } = useAuth();
  if (!user) {
    return (
      <Screen>
        <Title>Profile</Title>
        <EmptyState title="Log in to Showrooms" description="Save cars, follow showrooms and request viewings." actionTitle="Log in" onAction={() => router.push("/(auth)/login")} icon="person-outline" />
        <Button title="Create an account" variant="outline" onPress={() => router.push("/(auth)/role-selection")} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Title>Profile</Title>
      <AccountHeader />
      {isSeller(user) ? <MenuItem icon="speedometer-outline" label="Seller dashboard" onPress={() => router.replace("/(seller)/dashboard")} /> : null}
      <MenuItem icon="notifications-outline" label="Notifications" onPress={() => router.push("/notifications")} />
      <MenuItem icon="person-circle-outline" label="Edit profile" onPress={() => router.push("/(auth)/profile-setup")} />
      <MenuItem icon="shield-checkmark-outline" label="Buying safely" onPress={() => Linking.openURL(`${SITE_URL}/how-it-works`)} />
      <MenuItem icon="storefront-outline" label="Sell on Showrooms" onPress={() => Linking.openURL(`${SITE_URL}/sell`)} />
      <SignOutButton />
    </Screen>
  );
}
