import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useVehicle } from '@/data/hooks';
import { formatPlate } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

const POWERTRAIN_LABEL: Record<string, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  electric: 'Electric',
};

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={
        <Button variant="ghost" onPress={() => router.push(`/vehicle/${id}/sell`)}>
          Sell or transfer vehicle
        </Button>
      }>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← BACK
        </T>
      </Pressable>

      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(vehicle) => (
          <>
            <T variant="eyebrow" style={styles.eyebrow}>
              VEHICLE DETAILS
            </T>
            <T variant="display" style={styles.title}>
              {vehicle.make} {vehicle.model}
            </T>

            <Card padded={false} style={styles.card}>
              <ListRow title="Registration" meta={formatPlate(vehicle.plate)} onPress={() => router.push(`/vehicle/${id}/plate`)} />
              <ListRow title="VIN" meta={vehicle.vin ?? 'NOT YET ADDED'} onPress={vehicle.vin ? undefined : () => router.push(`/vehicle/${id}/vin`)} />
              <ListRow title="Year" meta={String(vehicle.year)} />
              <ListRow title="Engine" meta="NOT YET ADDED" />
              <ListRow title="Drivetrain" meta="NOT YET ADDED" />
              <ListRow title="Suspension" meta="NOT YET ADDED" />
              <ListRow title="Colour" meta={vehicle.color ?? 'NOT YET ADDED'} />
              <ListRow title="Tyre size" meta="NOT YET ADDED" />
              <ListRow title="Purchased" meta="NOT YET ADDED" />
              <ListRow
                title="Powertrain"
                meta={vehicle.powertrain ? POWERTRAIN_LABEL[vehicle.powertrain] : 'NOT YET ADDED'}
                onPress={() => router.push(`/vehicle/${id}/powertrain`)}
              />
              <ListRow title="Transmission" meta="NOT YET ADDED" />
              <ListRow title="Distance unit" meta="Kilometres" bordered={false} />
            </Card>

            <View style={styles.footnoteWrap}>
              <T variant="meta">
                EVERYTHING BELOW REGISTRATION IS OPTIONAL. IT SHARPENS COST PER KM AND SERVICE INTERVALS.
              </T>
            </View>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  eyebrow: {
    marginTop: Spacing.md,
  },
  title: {
    marginBottom: Spacing.md,
  },
  card: {
    padding: Spacing.md,
  },
  footnoteWrap: {
    marginTop: Spacing.md,
  },
});
