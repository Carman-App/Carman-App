import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useDocument, useVehicle } from '@/data/hooks';
import { deleteDocument, updateDocument } from '@/data/repo';
import { daysUntil, formatPlate } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const docQuery = useDocument(id);
  const doc = docQuery.data;
  const vehicle = useVehicle(doc?.vehicleId).data;
  const [title, setTitle] = useState(doc?.title ?? '');
  const [expiry, setExpiry] = useState(doc?.expiryDate ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `useDocument` has no GET-by-id endpoint to fall back on — it only reads
  // an already-fetched list's cache (see @/data/hooks). Don't bail out to the
  // "not found" case while that lookup query is still settling on first mount.
  if (docQuery.isLoading) {
    return (
      <Screen header={<TopBar backLabel="BACK" />}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!doc) return null;

  const days = doc.expiryDate ? daysUntil(doc.expiryDate) : null;
  const statusLabel = days == null ? 'NO EXPIRY SET' : days < 0 ? 'EXPIRED' : `EXPIRES IN ${days} DAY${days === 1 ? '' : 'S'}`;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDocument(id, { title: title.trim() || doc.title, expiryDate: expiry || undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={
        <Button onPress={handleSave} loading={saving}>
          Save changes
        </Button>
      }>

      <T variant="eyebrow" style={styles.eyebrow}>
        DOCUMENTS
      </T>
      <T variant="meta" color={Colors.warning}>
        {statusLabel}
      </T>
      <T variant="display" style={styles.title}>
        {doc.title}
      </T>

      <Pressable style={styles.uploadArea} onPress={() => router.push({ pathname: '/doc/scan', params: { documentId: id } })}>
        <IconGlyph glyph="camera" size={48} />
        <T variant="bodyStrong" style={styles.uploadLabel}>
          TAP TO UPLOAD
        </T>
        <T variant="meta">Nothing attached · Upload a photo or PDF</T>
      </Pressable>

      <TextField label="Name" value={title} onChangeText={setTitle} placeholder="Document name" />

      <View style={styles.readOnlyRow}>
        <T variant="eyebrow">LINKED VEHICLE</T>
        <T variant="bodyStrong">{vehicle ? `${vehicle.make} ${vehicle.model} · ${formatPlate(vehicle.plate)}` : '—'}</T>
      </View>

      <TextField
        label="Expiry"
        value={expiry}
        onChangeText={setExpiry}
        placeholder="YYYY-MM-DD"
        helper={expiry ? `Reminder set ${daysUntil(expiry)} days from now` : undefined}
      />

      <T variant="body" color={Colors.textMuted} style={styles.explainer}>
        Reminders are set from the expiry date. Documents stay on file after they expire, so the history holds; nothing is
        removed unless you delete it.
      </T>

      {error ? (
        <T variant="body" color={Colors.danger} center style={styles.error}>
          {error}
        </T>
      ) : null}

      <Button variant="danger" loading={deleting} onPress={handleDelete} style={styles.deleteBtn}>
        Delete this document
      </Button>
      <T variant="meta" center style={styles.deleteHelper}>
        THE ONLY WAY A DOCUMENT LEAVES CARMA.
      </T>

      <View style={styles.footerLinks}>
        <Pressable>
          <T variant="eyebrowStrong" color={Colors.textMuted}>
            SHARE
          </T>
        </Pressable>
        <Pressable>
          <T variant="eyebrowStrong" color={Colors.textMuted}>
            DOWNLOAD
          </T>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  content: {
    paddingTop: Spacing.sm,
  },
  eyebrow: {
    marginTop: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
    marginBottom: Spacing.lg,
  },
  uploadArea: {
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  uploadLabel: {
    letterSpacing: 1,
  },
  readOnlyRow: {
    gap: Spacing.xxs,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  explainer: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  error: {
    marginTop: Spacing.sm,
  },
  deleteBtn: {
    marginTop: Spacing.sm,
  },
  deleteHelper: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
