import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { RECORD_CATEGORIES, type CategoryConfig } from '@/features/record/categories';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { formatDistance } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

export default function AddRecordScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicle = useResolvedVehicle(vehicleId);

  const handlePick = (category: CategoryConfig) => {
    if (!vehicle) return;
    if (category.route === '/record/expense') {
      router.push({ pathname: '/record/expense', params: { vehicleId: vehicle.id, categoryLabel: category.label } });
      return;
    }
    router.push({ pathname: category.route, params: { vehicleId: vehicle.id } });
  };

  if (!vehicle) {
    return (
      <Screen>
        <ModalHeader eyebrow="ADD RECORD" title="No vehicle yet" />
        <T variant="body" color={Colors.textMuted}>
          Add a vehicle to your garage first, then come back here to log fuel, service and other costs.
        </T>
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <ModalHeader eyebrow={`ADD TO ${vehicle.make} ${vehicle.model} · ${formatDistance(vehicle.odometerKm)}`.toUpperCase()} />
      <T variant="display" style={styles.title}>
        What happened?
      </T>
      <Card padded={false} style={styles.list}>
        {RECORD_CATEGORIES.map((category, i) => (
          <ListRow
            key={category.key}
            bordered={i < RECORD_CATEGORIES.length - 1}
            title={category.label}
            subtitle={category.sub}
            onPress={() => handlePick(category)}
            style={styles.row}
            left={<IconGlyph glyph={category.glyph} size={36} />}
          />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  title: {
    marginBottom: Spacing.md,
  },
  list: {
    padding: Spacing.sm,
  },
  row: {
    paddingHorizontal: Spacing.sm,
  },
});
