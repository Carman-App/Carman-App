import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useGarageMembers, useGarages, useVehicles } from '@/data/hooks';
import { setActiveGarage } from '@/data/repo';
import type { Garage } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

const MAX_GARAGES = 2;

export default function GaragesListScreen() {
  const garagesQuery = useGarages();

  const openGarage = async (garage: Garage) => {
    await setActiveGarage(garage.id);
    router.push(`/garages/${garage.id}`);
  };

  return (
    <Screen header={<TopBar backLabel="BACK" />} scroll contentStyle={styles.content}>

      <T variant="display" style={styles.title}>
        Your garages
      </T>
      <T variant="body" color={Colors.textMuted} style={styles.sub}>
        A garage keeps its own vehicles, members and history. Switch between them at any time.
      </T>

      {/* isEmpty disabled: even with zero garages, the "Add a garage" row below stays the way in — there's no separate empty state to show. */}
      <QueryBoundary query={garagesQuery} isEmpty={() => false}>
        {(garages) => (
          <>
            <T variant="eyebrow" style={styles.eyebrow}>
              {garages.length} {garages.length === 1 ? 'GARAGE' : 'GARAGES'} · UP TO {Math.max(MAX_GARAGES, garages.length)} ON YOUR PLAN
            </T>
            <Card padded={false} style={styles.card}>
              {garages.map((garage, i) => (
                <GarageRow key={garage.id} garage={garage} bordered={i < garages.length - 1} onPress={() => openGarage(garage)} />
              ))}
              <Pressable style={styles.addRow} onPress={() => router.push('/garages/add')}>
                <IconGlyph glyph="garage" size={40} />
                <T variant="bodyStrong" color={Colors.accent} style={styles.addLabel}>
                  Add a garage
                </T>
              </Pressable>
            </Card>
          </>
        )}
      </QueryBoundary>

      <T variant="meta" style={styles.footnote}>
        MOVING A VEHICLE BETWEEN GARAGES CARRIES ITS FULL HISTORY WITH IT.
      </T>
    </Screen>
  );
}

function GarageRow({ garage, bordered, onPress }: { garage: Garage; bordered: boolean; onPress: () => void }) {
  const vehiclesQuery = useVehicles(garage.id);
  const membersQuery = useGarageMembers(garage.id);
  const vehicleCount = vehiclesQuery.data?.length ?? 0;
  const memberCount = membersQuery.data?.length ?? 0;

  return (
    <ListRow
      bordered={bordered}
      onPress={onPress}
      left={<IconGlyph glyph="garage" size={40} />}
      title={garage.name}
      subtitle={`${vehicleCount} ${vehicleCount === 1 ? 'VEHICLE' : 'VEHICLES'} · ${memberCount} ${memberCount === 1 ? 'MEMBER' : 'MEMBERS'} · ${garage.location}`}
      style={styles.row}
    />
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
    marginTop: Spacing.xxs,
  },
  sub: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  card: {
    padding: Spacing.md,
  },
  row: {
    paddingHorizontal: Spacing.xxs,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  addLabel: {
    flex: 1,
  },
  footnote: {
    marginTop: Spacing.md,
  },
});
