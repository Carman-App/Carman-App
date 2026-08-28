import { router } from 'expo-router';

import { Card } from '@/components/ui/Card';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarageId, useVehicles } from '@/data/hooks';
import { formatPlate } from '@/lib/format';
import { USAGE_LABEL } from '@/types/domain';
import { Spacing } from '@/theme/tokens';
import { StyleSheet } from 'react-native';

/**
 * Standalone vehicle picker for the add-record flow. Reachable directly, or
 * used to force a choice when a sub-step is missing a `vehicleId`. Picking a
 * vehicle re-enters the category list for it.
 */
export default function PickVehicleScreen() {
  const garageId = useActiveGarageId();
  const vehiclesQuery = useVehicles(garageId ?? undefined);

  return (
    <Screen scroll>
      <ModalHeader eyebrow="ADD RECORD" title="Select vehicle" />
      <QueryBoundary
        query={vehiclesQuery}
        empty={{ glyph: 'garage', title: 'No vehicles yet', body: 'Add a vehicle to your garage before logging a record.' }}>
        {(vehicles) => (
          <Card padded={false} style={styles.list}>
            {vehicles.map((v, i) => (
              <ListRow
                key={v.id}
                bordered={i < vehicles.length - 1}
                title={`${v.make} ${v.model}`}
                subtitle={`${formatPlate(v.plate)} · ${USAGE_LABEL[v.usage]}`}
                left={<IconGlyph glyph={v.type === 'car' ? 'vehicle' : 'motorcycle'} size={36} />}
                onPress={() => router.replace({ pathname: '/record/add', params: { vehicleId: v.id } })}
                style={styles.row}
              />
            ))}
          </Card>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.sm,
  },
  row: {
    paddingHorizontal: Spacing.sm,
  },
});
