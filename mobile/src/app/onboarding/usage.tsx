import { Redirect } from 'expo-router';

/** Usage is now chosen on the vehicle-type step ("How it gets used"). */
export default function UsageRedirect() {
  return <Redirect href="/onboarding/vehicle-type" />;
}
