import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { ProgressBar } from '@/components/ui/Blocks';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveGarage, useGarageDocuments, useVehicles } from '@/data/hooks';
import { daysUntil, formatDateWithYear } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';
import type { DocumentType, VehicleDocument } from '@/types/domain';

type Filter = 'all' | 'expiring' | 'superseded';

const TYPE_LABEL: Record<DocumentType, string> = {
  insurance: 'Insurance',
  logbook: 'Logbook',
  inspection: 'Inspection',
  invoice: 'Invoice',
  receipt: 'Receipt',
};

/** A document is superseded when a newer one of the same type exists for the same vehicle. */
export function supersededIds(docs: VehicleDocument[]) {
  const out = new Set<string>();
  const groups = new Map<string, VehicleDocument[]>();
  for (const d of docs) {
    if (d.type === 'invoice' || d.type === 'receipt') continue;
    const k = `${d.vehicleId}:${d.type}`;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => ((a.expiryDate ?? a.addedAt) < (b.expiryDate ?? b.addedAt) ? 1 : -1));
    sorted.slice(1).forEach((d) => out.add(d.id));
  }
  return out;
}

function timeLeft(days: number) {
  if (days < 0) return 'Expired';
  if (days <= 45) return `${days} days left`;
  const months = Math.round(days / 30);
  return months >= 12 ? `${Math.round(months / 12)} year${months >= 18 ? 's' : ''} left` : `${months} months left`;
}

/** Documents. Expiry sorts the list. Renewing supersedes rather than overwrites. */
export default function DocumentsScreen() {
  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const documentsQuery = useGarageDocuments(garage?.id);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const [filter, setFilter] = useState<Filter>('all');
  const superseded = useMemo(() => supersededIds(documents), [documents]);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v] as const));

  const sorted = useMemo(() => {
    const live = documents.filter((d) => !superseded.has(d.id));
    const old = documents.filter((d) => superseded.has(d.id));
    const byExpiry = (a: VehicleDocument, b: VehicleDocument) => (a.expiryDate ?? '9999') < (b.expiryDate ?? '9999') ? -1 : 1;
    if (filter === 'expiring') return live.filter((d) => d.expiryDate && daysUntil(d.expiryDate) <= 90).sort(byExpiry);
    if (filter === 'superseded') return old.sort(byExpiry);
    return [...live.sort(byExpiry), ...old.sort(byExpiry)];
  }, [documents, superseded, filter]);

  return (
    <Screen
      padded={false}
      header={<TopBar title="Documents" right={`${sorted.length} of ${documents.length}`} />}
      footer={
        <View style={styles.foot}>
          <Button style={styles.flex} glyph="scan" onPress={() => router.push('/doc/scan')}>
            Scan a document
          </Button>
          <IconButton glyph="upload-file" size={64} bg={Colors.white} fg={Colors.accent} style={styles.upload} onPress={() => router.push({ pathname: '/doc/scan', params: { mode: 'upload' } })} accessibilityLabel="Upload a file" />
        </View>
      }>
      <View style={styles.filters}>
        <Segmented
          caps={false}
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All' },
            { key: 'expiring', label: 'Expiring' },
            { key: 'superseded', label: 'Superseded' },
          ]}
        />
      </View>
      <QueryBoundary query={documentsQuery} isEmpty={() => false}>
        {() =>
          sorted.length === 0 ? (
            <EmptyState glyph="document" title="No documents filed." body="Photograph the licence and insurance certificate once. Carma reads the expiry dates and warns you before either runs out." />
          ) : (
            <>
              {sorted.map((d) => {
                const v = vehicleById.get(d.vehicleId);
                const isOld = superseded.has(d.id);
                const days = d.expiryDate ? daysUntil(d.expiryDate) : null;
                const urgent = days !== null && days <= 30;
                return (
                  <Pressable key={d.id} onPress={() => router.push(`/doc/${d.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F7F5F2' }]}>
                    <View style={styles.thumb}>
                      <IconGlyph glyph="document" size={30} bg="transparent" fg={Colors.textFaint} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.between}>
                        <T variant="small" color={Colors.accent}>
                          {TYPE_LABEL[d.type]}
                        </T>
                        <T variant="small" color={isOld ? Colors.textMuted : urgent ? Colors.signal : Colors.body}>
                          {isOld ? 'Superseded' : days !== null ? timeLeft(days) : d.type === 'invoice' ? 'Linked' : 'No expiry'}
                        </T>
                      </View>
                      <T variant="bodyStrong" style={styles.title}>
                        {d.title}
                      </T>
                      <T variant="meta">
                        {d.expiryDate ? `${isOld || (days ?? 0) < 0 ? 'Expired' : 'Expires'} ${formatDateWithYear(d.expiryDate)}` : `Added ${formatDateWithYear(d.addedAt.slice(0, 10))}`}
                        {v ? ` · ${v.model}` : ''}
                        {isOld ? ' · still readable' : ''}
                      </T>
                      {days !== null && !isOld ? (
                        <View style={styles.bar}>
                          <ProgressBar progress={Math.max(0.04, Math.min(1, days / 365))} color={urgent ? Colors.signal : Colors.accent} height={4} />
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              <T variant="meta" style={styles.note}>
                Renewing keeps the old document readable and marks it superseded.
              </T>
            </>
          )
        }
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  thumb: {
    width: 36,
    height: 44,
    borderRadius: 4,
    backgroundColor: Colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    marginTop: 4,
    marginBottom: 6,
  },
  bar: {
    marginTop: 10,
  },
  note: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upload: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
});
