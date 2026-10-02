import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { CATEGORY_TINT, RECORD_CATEGORIES, categoryHref } from '@/features/record/categories';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { formatNumber } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

/** The 18-action record selector as a full screen (opened from a vehicle). Home opens the same list as a sheet. */
export default function AddRecordScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicle = useResolvedVehicle(vehicleId);

  return (
    <Screen header={<TopBar backGlyph="close" backLabel="CLOSE" right={vehicle ? `${vehicle.model} · ${formatNumber(vehicle.odometerKm)} KM`.toUpperCase() : undefined} />}>
      <T variant="display" style={styles.title}>
        Add a record
      </T>
      {!vehicle ? (
        <T variant="lede">Add a vehicle to your garage first, then come back to log fuel, service and other costs.</T>
      ) : (
        <View style={styles.grid}>
          {RECORD_CATEGORIES.map((c) => {
            const tint = CATEGORY_TINT[c.key];
            return (
              <Pressable
                key={c.key}
                onPress={() => router.push(categoryHref(c, vehicle.id) as never)}
                style={({ pressed }) => [styles.tile, pressed && { backgroundColor: Colors.accentSoft }]}>
                <IconGlyph glyph={c.glyph} size={34} shape="tile" bg={tint.tint} fg={tint.hue} />
                <View style={styles.text}>
                  <T variant="bodyStrong" numberOfLines={1}>
                    {c.label}
                  </T>
                  <T variant="eyebrow" numberOfLines={1} style={styles.sub}>
                    {c.sub}
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  grid: {
    gap: 8,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  sub: {
    fontSize: 9,
  },
});
