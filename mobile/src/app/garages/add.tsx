import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { addGarage } from '@/data/repo';
import { Colors, Spacing } from '@/theme/tokens';

const TOWNS = ['Nairobi', 'Mombasa', 'Nakuru', 'Kisumu', 'Nyeri', 'Eldoret'];

export default function AddGarageScreen() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [customTown, setCustomTown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const garage = await addGarage({ name: name.trim(), location: location.trim() || 'Not set' });
      router.replace(`/garages/${garage.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <Button disabled={!canSave} loading={saving} onPress={handleSave}>
          Name your garage
        </Button>
      }>
      <ModalHeader eyebrow="GARAGES" title="New garage" />

      <T variant="eyebrow" style={styles.section}>
        NAME IT
      </T>
      <TextField label="GARAGE NAME" value={name} onChangeText={setName} placeholder="e.g. Home Garage" autoFocus />

      <T variant="eyebrow" style={styles.section}>
        WHERE IT IS
      </T>
      <View style={styles.chipsRow}>
        {TOWNS.map((town) => (
          <Chip
            key={town}
            label={town}
            selected={!customTown && location === town}
            onPress={() => {
              setCustomTown(false);
              setLocation(town);
            }}
          />
        ))}
        <Pressable
          onPress={() => {
            setCustomTown(true);
            setLocation('');
          }}>
          <Chip label="+ Add town" selected={customTown} />
        </Pressable>
      </View>
      {customTown ? (
        <View style={styles.customField}>
          <TextField label="TOWN" value={location} onChangeText={setLocation} placeholder="Type a town" autoFocus />
        </View>
      ) : null}

      <T variant="meta" color={Colors.textMuted} style={styles.footnote}>
        YOU START AS THE ONLY MEMBER. INVITE PEOPLE ONCE THE GARAGE EXISTS.
      </T>

      {error ? (
        <T variant="body" color={Colors.error} center style={styles.error}>
          {error}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  customField: {
    marginTop: Spacing.md,
  },
  footnote: {
    marginTop: Spacing.xl,
  },
  error: {
    marginTop: Spacing.sm,
  },
});
