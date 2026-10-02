import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { PLACES } from '@/data/placesCatalog';
import { getActiveDistanceUnit, KM_TO_MI } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

/**
 * Standalone "pick a place" screen — a self-contained demo (no cross-screen
 * return value plumbing). Selecting any row or the typed fallback just closes
 * back to the caller; the caller's own inline place field is the real value
 * used when saving a record.
 *
 * The list itself is real, though: it's the prototype's curated nearby-places
 * catalogue (`src/data/placesCatalog.ts`), genuinely filtered by whichever
 * record category the caller passed in (`categoryLabel`) and by what's typed
 * in the search box — not a frozen list shown unchanged for every category.
 */
export default function PickPlaceScreen() {
  const { categoryLabel } = useLocalSearchParams<{ categoryLabel?: string }>();
  const [query, setQuery] = useState('');

  const nearby = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return PLACES.filter((p) => (p.name + ' ' + p.tag).toLowerCase().includes(q)).slice(0, 6);
    }
    const inCategory = categoryLabel ? PLACES.filter((p) => p.categories.includes(categoryLabel)) : [];
    const pool = inCategory.length ? inCategory : PLACES;
    return pool.slice(0, 6);
  }, [categoryLabel, query]);

  const typed = query.trim();
  const distanceUnit = getActiveDistanceUnit();

  return (
    <Screen scroll>
      <ModalHeader eyebrow={categoryLabel ? categoryLabel.toUpperCase() : undefined} title="Nairobi" />
      <TextField label="SEARCH" value={query} onChangeText={setQuery} placeholder="Search a place" />
      <T variant="eyebrow" style={styles.section}>
        {nearby.length} NEARBY
      </T>
      <Card padded={false} style={styles.list}>
        {nearby.map((place, i) => (
          <ListRow
            key={place.name}
            bordered={i < nearby.length - 1}
            title={place.name}
            // `placesCatalog.ts`'s distances are in km, one decimal place —
            // `formatDistance` rounds to whole numbers (matches odometer-style
            // displays elsewhere), so it doesn't fit here; converted locally instead.
            subtitle={`${place.tag} · ${place.road} · ${(distanceUnit === 'mi' ? place.km * KM_TO_MI : place.km).toFixed(1)} ${distanceUnit.toUpperCase()}`}
            left={<IconGlyph glyph="place" size={36} />}
            onPress={() => router.back()}
            style={styles.row}
          />
        ))}
      </Card>

      {typed ? (
        <Card style={styles.fallback} onPress={() => router.back()}>
          <T variant="bodyStrong" color={Colors.accent}>
            Use “{typed}”
          </T>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  list: {
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  row: {
    paddingHorizontal: Spacing.sm,
  },
  fallback: {
    gap: 2,
  },
});
