import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Footnote, KeyValueRow, ProgressBar, Rule } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { DateSheet } from '@/components/ui/DateSheet';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/data/api/client';
import { useDocument, useVehicle } from '@/data/hooks';
import { deleteDocument, updateDocument } from '@/data/repo';
import { daysUntil, formatDateWithYear, formatPlate } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import type { DocumentType } from '@/types/domain';

const TYPE_LABEL: Record<DocumentType, string> = {
  insurance: 'Insurance',
  logbook: 'Logbook',
  inspection: 'Inspection',
  invoice: 'Invoice',
  receipt: 'Receipt',
};

/** One document: what it is, which vehicle, when it runs out. Delete is the only way it leaves. */
export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const docQuery = useDocument(id);
  const doc = docQuery.data;
  const vehicle = useVehicle(doc?.vehicleId).data;
  const [title, setTitle] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // useDocument reads an already-fetched list's cache; wait for it before deciding the doc is gone.
  if (docQuery.isPending) {
    return (
      <Screen header={<TopBar backLabel="DOCUMENTS" />}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!doc) {
    return (
      <Screen header={<TopBar backLabel="DOCUMENTS" fallback="/documents" />}>
        <T variant="lede" style={styles.center}>
          This document is no longer on file.
        </T>
      </Screen>
    );
  }

  const name = title ?? doc.title;
  const expiryValue = expiry ?? doc.expiryDate ?? '';
  const dirty = name.trim() !== doc.title || expiryValue !== (doc.expiryDate ?? '');
  const days = expiryValue ? daysUntil(expiryValue) : null;
  const urgent = days !== null && days <= 30;
  const status = days === null ? 'No expiry set' : days < 0 ? `Expired ${-days} days ago` : `${days} days left`;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateDocument(id, { title: name.trim() || doc.title, expiryDate: expiryValue || undefined });
      setTitle(null);
      setExpiry(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const openFile = async () => {
    setOpening(true);
    setError(null);
    try {
      // Files are private: the API checks access and returns a link that expires in 10 minutes.
      const { url } = await api.get<{ url: string }>(`documents/${id}/file`);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the file.');
    } finally {
      setOpening(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteDocument(id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setDeleting(false);
    }
  };

  return (
    <Screen
      header={<TopBar backLabel="DOCUMENTS" right={TYPE_LABEL[doc.type].toUpperCase()} fallback="/documents" />}
      footer={
        <Button onPress={save} loading={saving} disabled={!dirty}>
          {dirty ? 'Save changes' : 'No changes'}
        </Button>
      }>
      <View style={styles.head}>
        <T variant="small" color={urgent ? Colors.signal : Colors.accent}>
          {status}
        </T>
        <T variant="display">{doc.title}</T>
        {days !== null && days >= 0 ? <ProgressBar progress={Math.max(0.04, Math.min(1, days / 365))} color={urgent ? Colors.signal : Colors.accent} /> : null}
      </View>

      <Pressable accessibilityRole="button"
        style={styles.file}
        onPress={() => (doc.fileRef ? void openFile() : router.push({ pathname: '/doc/scan', params: { documentId: id } }))}>
        <IconGlyph glyph={doc.fileRef ? 'document' : 'camera'} size={44} />
        <View style={styles.flex}>
          <T variant="bodyStrong">{doc.fileRef ? 'Photo on file' : 'Nothing attached'}</T>
          <T variant="meta">{doc.fileRef ? (opening ? 'Opening…' : 'Tap to open') : 'Add a photo or PDF'}</T>
        </View>
        <IconGlyph glyph="chevron-right" size={20} bg="transparent" fg={Colors.textFaint} />
      </Pressable>

      {doc.fileRef ? (
        <Pressable accessibilityRole="button" hitSlop={8} style={styles.replace} onPress={() => router.push({ pathname: '/doc/scan', params: { documentId: id } })}>
          <T variant="meta" color={Colors.accent}>
            Replace the file
          </T>
        </Pressable>
      ) : null}
      <Rule />
      <View style={styles.section}>
        <T variant="section">Details</T>
        <TextField label="Name" value={name} onChangeText={setTitle} placeholder="Document name" />
      </View>
      <KeyValueRow label="Vehicle" value={vehicle ? `${vehicle.make} ${vehicle.model}` : '—'} sub={vehicle ? formatPlate(vehicle.plate) : undefined} />
      <KeyValueRow label="Expiry" value={expiryValue ? formatDateWithYear(expiryValue) : 'Set a date'} valueColor={expiryValue ? undefined : Colors.accent} onPress={() => setPicking(true)} />
      <KeyValueRow label="Added" value={formatDateWithYear(doc.addedAt.slice(0, 10))} last />
      <Footnote style={styles.note}>CARMA REMINDS YOU 30 DAYS BEFORE EXPIRY. EXPIRED DOCUMENTS STAY ON FILE SO THE HISTORY HOLDS.</Footnote>

      {error ? (
        <T variant="body" color={Colors.signal} style={styles.note}>
          {error}
        </T>
      ) : null}

      <Rule />
      <View style={styles.section}>
        <Button variant="danger" size="md" loading={deleting} onPress={remove}>
          {confirmDelete ? 'Tap again to delete for good' : 'Delete this document'}
        </Button>
        <Footnote>THE ONLY WAY A DOCUMENT LEAVES CARMA.</Footnote>
      </View>

      <DateSheet visible={picking} value={expiryValue} title="Expires on" allowFuture onSelect={setExpiry} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  head: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 10,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.chip,
    marginBottom: Spacing.lg,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  replace: {
    alignSelf: 'flex-start',
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  section: {
    paddingVertical: Spacing.md,
    gap: 12,
  },
  note: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
});
