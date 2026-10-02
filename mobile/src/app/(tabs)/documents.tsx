import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useGarageDocuments, useVehicles } from '@/data/hooks';
import { daysUntil, formatDateWithYear, formatPlate } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

type Filter = 'all' | 'expiring' | 'receipts' | 'ownership';

export default function DocumentsScreen() {
  const garageQuery = useActiveGarage();
  const garage = garageQuery.data;
  const vehiclesQuery = useVehicles(garage?.id);
  const vehicles = vehiclesQuery.data ?? [];
  const documentsQuery = useGarageDocuments(garage?.id);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const [filter, setFilter] = useState<Filter>('all');

  const vehicleById = new Map(vehicles.map((v) => [v.id, v] as const));
  const expiringSoon = documents.filter((d) => d.expiryDate && daysUntil(d.expiryDate) <= 60 && daysUntil(d.expiryDate) >= 0);

  const filtered = useMemo(() => {
    if (filter === 'expiring') return documents.filter((d) => d.expiryDate && daysUntil(d.expiryDate) <= 60);
    if (filter === 'receipts') return documents.filter((d) => d.type === 'receipt' || d.type === 'invoice');
    if (filter === 'ownership') return documents.filter((d) => d.type === 'logbook');
    return documents;
  }, [documents, filter]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <T variant="eyebrowStrong" color={Colors.textMuted}>DOCUMENTS</T>
      <T variant="display" style={styles.title}>
        Documents
      </T>
      {expiringSoon.length > 0 ? (
        <T variant="meta" color={Colors.warning} style={styles.expiryNote}>
          {expiringSoon.length} document{expiringSoon.length === 1 ? '' : 's'} expiring soon
        </T>
      ) : null}

      <View style={styles.filterRow}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Expiring" selected={filter === 'expiring'} onPress={() => setFilter('expiring')} />
        <Chip label="Receipts" selected={filter === 'receipts'} onPress={() => setFilter('receipts')} />
        <Chip label="Ownership" selected={filter === 'ownership'} onPress={() => setFilter('ownership')} />
      </View>

      <QueryBoundary query={documentsQuery} isEmpty={() => false}>
        {() =>
          filtered.length === 0 ? (
            <EmptyState
              glyph="document"
              title="No documents filed."
              body="Photograph the licence and insurance certificate once. Carma reads the expiry dates and warns you before either runs out."
            />
          ) : (
            filtered.map((d) => {
              const v = vehicleById.get(d.vehicleId);
              const days = d.expiryDate ? daysUntil(d.expiryDate) : null;
              return (
                <ListRow
                  key={d.id}
                  left={<IconGlyph glyph="document" size={36} />}
                  title={d.title}
                  subtitle={v ? `${v.make} ${v.model} · ${formatPlate(v.plate)}` : undefined}
                  meta={d.expiryDate ? `${days != null && days < 0 ? 'EXPIRED' : 'EXPIRES'} ${formatDateWithYear(d.expiryDate)}` : undefined}
                  onPress={() => router.push(`/doc/${d.id}`)}
                />
              );
            })
          )
        }
      </QueryBoundary>

      <View style={styles.actions}>
        <ListRow title="Scan a document" left={<IconGlyph glyph="scan" size={36} />} onPress={() => router.push('/doc/scan')} />
        <ListRow title="Upload a file" left={<IconGlyph glyph="document" size={36} />} bordered={false} onPress={() => router.push('/doc/scan')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  title: {
    marginTop: Spacing.xs,
  },
  expiryNote: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginVertical: Spacing.md,
  },
  actions: {
    marginTop: Spacing.lg,
  },
});
