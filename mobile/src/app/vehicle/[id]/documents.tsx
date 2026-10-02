import { Redirect, useLocalSearchParams } from 'expo-router';

/** A vehicle's papers: the Documents screen, scoped to this vehicle. */
export default function VehicleDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/documents', params: { vehicleId: id } }} />;
}
