import { Redirect, useLocalSearchParams } from 'expo-router';

/** Fuel is one of the categories in the unified record form. Kept as a route so older links still land. */
export default function FuelRedirect() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  return <Redirect href={{ pathname: '/record/expense', params: { categoryKey: 'fuel', ...(vehicleId ? { vehicleId } : {}) } }} />;
}
