import { Redirect, useLocalSearchParams } from 'expo-router';

/** Service is one of the categories in the unified record form. Kept as a route so older links still land. */
export default function ServiceRedirect() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  return <Redirect href={{ pathname: '/record/expense', params: { categoryKey: 'service', ...(vehicleId ? { vehicleId } : {}) } }} />;
}
