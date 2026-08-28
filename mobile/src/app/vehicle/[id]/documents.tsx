import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useDocuments, useVehicle } from '@/data/hooks';
import { daysUntil, formatDateWithYear } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

type Filter = 'all' | 'expiring' | 'receipts' | 'ownership';

export default function VehicleDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const documentsQuery = useDocuments(id);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const [filter, setFilter] = useState<Filter>('all');

  const expiringSoon = documents.filter((d) => d.expiryDate && daysUntil(d.expiryDate) <= 60 && daysUntil(d.expiryDate) >= 0);

  const filtered = useMemo(() => {
    if (filter === 'expiring') return documents.filter((d) => d.expiryDate && daysUntil(d.expiryDate) <= 60);
    if (filter === 'receipts') return documents.filter((d) => d.type === 'receipt' || d.type === 'invoice');
    if (filter === 'ownership') return documents.filter((d) => d.type === 'logbook');
    return documents;
  }, [documents, filter]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(vehicle) => (
          <>
            <Pressable onPress={() => router.back()}>
              <T variant="eyebrowStrong" color={Colors.accent}>
                ← {vehicle.make.toUpperCase()} {vehicle.model.toUpperCase()}
              </T>
            </Pressable>

            <T variant="eyebrow" style={styles.count}>
              {documents.length === 0 ? 'NONE FILED' : `${documents.length} DOCUMENT${documents.length === 1 ? '' : 'S'}`}
            </T>
            <T variant="display" style={styles.title}>
              Documents
            </T>
            {expiringSoon.length > 0 ? (
              <T variant="meta" color={Colors.warning} style={styles.expiryNote}>
                {expiringSoon.length === 1
                  ? `1 document expires in ${daysUntil(expiringSoon[0].expiryDate!)} days`
                  : `${expiringSoon.length} documents expiring soon`}
              </T>
            ) : null}

            <View style={styles.filterRow}>
              <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
              <Chip label="Expiring" selected={filter === 'expiring'} onPress={() => setFilter('expiring')} />
              <Chip label="Receipts" selected={filter === 'receipts'} onPress={() => setFilter('receipts')} />
              <Chip label="Ownership" selected={filter === 'ownership'} onPress={() => setFilter('ownership')} />
            </View>

            {filtered.length === 0 ? (
              <EmptyState
                glyph="document"
                title="No documents filed."
                body="Photograph the licence and insurance certificate once. Carma reads the expiry dates and warns you before either runs out."
              />
            ) : (
              filtered.map((d) => {
                const days = d.expiryDate ? daysUntil(d.expiryDate) : null;
                return (
                  <ListRow
                    key={d.id}
                    left={<IconGlyph glyph="document" size={36} />}
                    title={d.title}
                    meta={
                      d.expiryDate
                        ? days != null && days < 0
                          ? `EXPIRED ${formatDateWithYear(d.expiryDate)}`
                          : `EXPIRES ${formatDateWithYear(d.expiryDate)} · ${days} DAYS`
                        : undefined
                    }
                    onPress={() => router.push(`/doc/${d.id}`)}
                  />
                );
              })
            )}

            <View style={styles.actions}>
              <ListRow
                title="Scan a document"
                left={<IconGlyph glyph="scan" size={36} />}
                onPress={() => router.push({ pathname: '/doc/scan', params: { vehicleId: id } })}
              />
              <ListRow
                title="Upload a file"
                left={<IconGlyph glyph="document" size={36} />}
                bordered={false}
                onPress={() => router.push({ pathname: '/doc/scan', params: { vehicleId: id } })}
              />
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
  count: {
    marginTop: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
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
