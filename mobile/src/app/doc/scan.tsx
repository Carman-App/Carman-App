import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useActiveGarage, useDocument, useVehicles } from '@/data/hooks';
import { addDocument, updateDocument } from '@/data/repo';
import { todayIso } from '@/lib/format';
import type { DocumentType } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const TYPES: { key: DocumentType; label: string }[] = [
  { key: 'insurance', label: 'Insurance' },
  { key: 'logbook', label: 'Logbook' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'receipt', label: 'Receipt' },
];

/**
 * Two states, one screen (prototype screens 36/38 DOCUMENT SCAN):
 *  - New document (no `documentId` param): reached from Documents list or
 *    Vehicle Added's "Add insurance document" — pick a type, title, expiry.
 *  - Replace existing scan (`documentId` param present): reached from the
 *    DOCUMENT detail screen's "TAP TO UPLOAD" row on a document that already
 *    has its metadata set — just re-attach the file, no type/title/expiry
 *    fields to repeat.
 */
export default function ScanDocumentScreen() {
  const { vehicleId: paramVehicleId, documentId } = useLocalSearchParams<{ vehicleId?: string; documentId?: string }>();
  const existingDoc = useDocument(documentId).data;
  const isReplace = !!documentId;

  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const [type, setType] = useState<DocumentType>('insurance');
  const [title, setTitle] = useState('');
  const [expiry, setExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveNew = async () => {
    const vehicleId = paramVehicleId || vehicles[0]?.id;
    if (!vehicleId || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addDocument(vehicleId, { type, title: title.trim(), expiryDate: expiry || undefined, addedAt: todayIso() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReplace = async () => {
    if (!documentId) return;
    setSaving(true);
    setError(null);
    try {
      await updateDocument(documentId, { addedAt: todayIso() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isReplace) {
    return (
      <Screen
        contentStyle={styles.content}
        footer={
          <Button onPress={handleReplace} loading={saving}>
            Replace file
          </Button>
        }>
        <ModalHeader eyebrow="DOCUMENTS" title={existingDoc?.title ?? 'Replace scan'} />

        <Pressable style={styles.scanArea}>
          <IconGlyph glyph="scan" size={64} />
          <T variant="bodyStrong" style={styles.scanLabel}>
            SCAN
          </T>
          <T variant="meta">Nothing attached · Upload a photo or PDF</T>
        </Pressable>

        <T variant="body" color={Colors.textMuted} style={styles.replaceNote}>
          This replaces the file attached to {existingDoc?.title ?? 'this document'}. Its name, linked vehicle and expiry
          date stay as they are.
        </T>

        {error ? (
          <T variant="body" color={Colors.danger} center style={styles.error}>
            {error}
          </T>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={
        <Button onPress={handleSaveNew} loading={saving} disabled={!title.trim()}>
          Save document
        </Button>
      }>
      <ModalHeader eyebrow="DOCUMENTS" title="Scan document" />

      <Pressable style={styles.scanArea}>
        <IconGlyph glyph="scan" size={64} />
        <T variant="bodyStrong" style={styles.scanLabel}>
          SCAN
        </T>
        <T variant="meta">Nothing attached · Upload a photo or PDF</T>
      </Pressable>

      <T variant="eyebrow" style={styles.sectionLabel}>
        DOCUMENT TYPE
      </T>
      <View style={styles.typeRow}>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
        ))}
      </View>

      <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Jubilee Comprehensive Cover" />
      <View style={styles.spacer} />
      <TextField label="Expiry (optional)" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" />

      {error ? (
        <T variant="body" color={Colors.danger} center style={styles.error}>
          {error}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  scanArea: {
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  replaceNote: {
    marginTop: Spacing.sm,
  },
  scanLabel: {
    letterSpacing: 1,
  },
  sectionLabel: {
    marginBottom: Spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  spacer: {
    height: Spacing.md,
  },
  error: {
    marginTop: Spacing.sm,
  },
});
