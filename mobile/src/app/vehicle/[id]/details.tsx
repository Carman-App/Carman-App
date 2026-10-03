import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Footnote, KeyValueRow, Rule } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useVehicle } from '@/data/hooks';
import { formatNumber, formatPlate } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

const POWERTRAIN_LABEL: Record<string, string> = { petrol: 'Petrol', diesel: 'Diesel', hybrid: 'Hybrid', electric: 'Electric' };

/** Vehicle details: identity first, then the optional fields that sharpen cost per km and service intervals. */
export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);

  return (
    <Screen
      header={<TopBar backLabel="VEHICLE" right="VEHICLE DETAILS" />}
      footer={
        <Button caps onPress={() => router.push(`/vehicle/${id}/sell`)}>
          Sell or transfer vehicle
        </Button>
      }>
      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(v) => (
          <>
            <T variant="display" style={styles.title}>
              {v.make} {v.model}
            </T>
            <Rule />
            <KeyValueRow tone="caps" label="Registration" value={formatPlate(v.plate)} onPress={() => router.push(`/vehicle/${id}/plate`)} valueColor={Colors.ink} />
            <KeyValueRow tone="caps" label="VIN" value={v.vin ?? 'Add'} onPress={() => router.push(`/vehicle/${id}/vin`)} valueColor={v.vin ? Colors.ink : Colors.accent} />
            <KeyValueRow tone="caps" label="Make" value={v.make} />
            <KeyValueRow tone="caps" label="Model" value={v.model} />
            <KeyValueRow tone="caps" label="Year" value={String(v.year)} />
            <KeyValueRow tone="caps" label="Trim" value={v.variant || '—'} />
            <KeyValueRow tone="caps" label="Colour" value={v.color ?? '—'} />
            <KeyValueRow tone="caps" label="Next service" value={v.nextServiceDueKm ? `Next at ${formatNumber(v.nextServiceDueKm)} km` : '—'} />
            <KeyValueRow
              tone="caps"
              label="Powertrain"
              value={v.powertrain ? POWERTRAIN_LABEL[v.powertrain] : 'Add'}
              valueColor={v.powertrain ? Colors.ink : Colors.accent}
              onPress={() => router.push(`/vehicle/${id}/powertrain`)}
              last
            />
            <Rule />
            <View style={styles.note}>
              <Footnote>EVERYTHING BELOW REGISTRATION IS OPTIONAL. IT SHARPENS COST PER KM AND SERVICE INTERVALS.</Footnote>
            </View>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  note: {
    paddingVertical: Spacing.md,
  },
});
