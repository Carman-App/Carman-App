import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Footnote, KeyValueRow, Rule } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DateSheet } from '@/components/ui/DateSheet';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveGarage, useDocument, useVehicles } from '@/data/hooks';
import { chooseFile, describeFile, takePhoto, uploadFile, type PickedFile } from '@/features/documents/upload';
import { addDocument, updateDocument } from '@/data/repo';
import { formatDateWithYear, formatNumber, todayIso } from '@/lib/format';
import type { DocumentType } from '@/types/domain';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

const TYPES: { key: DocumentType; label: string }[] = [
  { key: 'insurance', label: 'Insurance' },
  { key: 'logbook', label: 'Logbook' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'receipt', label: 'Receipt' },
];

/**
 * Two states, one screen:
 *  - New document (no `documentId`): from Documents or a vehicle's papers.
 *    Pick the type, name it, link a vehicle, set the expiry.
 *  - Replace (`documentId`): from a document's page. Re-attach the file only;
 *    name, vehicle and expiry stay as they are.
 */
export default function ScanDocumentScreen() {
  const { vehicleId: paramVehicleId, documentId, mode } = useLocalSearchParams<{ vehicleId?: string; documentId?: string; mode?: string }>();
  const existingDoc = useDocument(documentId).data;
  const isReplace = !!documentId;
  const upload = mode === 'upload';

  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const [type, setType] = useState<DocumentType>('insurance');
  const [title, setTitle] = useState('');
  const [expiry, setExpiry] = useState('');
  const [pickedVehicleId, setPickedVehicleId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'vehicle' | 'expiry' | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicleId = pickedVehicleId ?? paramVehicleId ?? vehicles[0]?.id;
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const hasExpiry = type === 'insurance' || type === 'inspection' || type === 'logbook';

  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const pick = async (how: 'camera' | 'file') => {
    setError(null);
    try {
      const f = how === 'camera' ? await takePhoto() : await chooseFile();
      if (f) setFile(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    }
  };

  const saveNew = () => {
    if (!vehicleId || !title.trim()) return;
    void run(async () => {
      const uploaded = file ? await uploadFile(vehicleId, file) : null;
      await addDocument(vehicleId, { type, title: title.trim(), expiryDate: (hasExpiry && expiry) || undefined, addedAt: todayIso(), fileRef: uploaded?.fileKey });
    });
  };

  const replace = () => {
    if (!documentId || !existingDoc || !file) return;
    void run(async () => {
      const uploaded = await uploadFile(existingDoc.vehicleId, file);
      await updateDocument(documentId, { fileRef: uploaded.fileKey });
    });
  };

  const frame = (
    <View style={styles.frameWrap}>
      <View style={styles.frame}>
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
        {file ? (
          <>
            <T variant="bodyStrong" center>
              {describeFile(file)}
            </T>
            <T variant="eyebrow" color={Colors.slate} center>
              READY TO UPLOAD
            </T>
          </>
        ) : (
          <T variant="eyebrow" color={Colors.slate} center>
            {upload ? 'PHOTO OR PDF, UP TO 15 MB' : 'FIT THE PAGE INSIDE THE CORNERS'}
          </T>
        )}
      </View>
      <View style={styles.pickRow}>
        {Platform.OS !== 'web' ? (
          <Button variant={upload ? 'secondary' : 'strong'} size="md" glyph="camera" style={styles.flex} onPress={() => void pick('camera')}>
            {file ? 'Retake' : 'Take a photo'}
          </Button>
        ) : null}
        <Button variant={upload || Platform.OS === 'web' ? 'strong' : 'secondary'} size="md" glyph="upload-file" style={styles.flex} onPress={() => void pick('file')}>
          {file ? 'Choose another' : 'Choose a file'}
        </Button>
      </View>
    </View>
  );

  const errorLine = error ? (
    <T variant="body" color={Colors.signal} style={styles.error}>
      {error}
    </T>
  ) : null;

  if (isReplace) {
    return (
      <Screen
        header={<TopBar backLabel="DOCUMENT" right="REPLACE FILE" />}
        footer={
          <Button onPress={replace} loading={saving} disabled={!file}>
            {file ? 'Replace file' : 'Pick the new file first'}
          </Button>
        }>
        <View style={styles.head}>
          <T variant="display">{existingDoc?.title ?? 'Replace the file'}</T>
          <T variant="lede">Its name, vehicle and expiry stay as they are. Only the attached file changes.</T>
        </View>
        {frame}
        {errorLine}
      </Screen>
    );
  }

  return (
    <Screen
      header={<TopBar backLabel="BACK" right={upload ? 'UPLOAD A FILE' : 'SCAN A DOCUMENT'} />}
      footer={
        <Button onPress={saveNew} loading={saving} disabled={!title.trim() || !vehicleId}>
          {!vehicleId ? 'Add a vehicle first' : title.trim() ? 'Save document' : 'Name it first'}
        </Button>
      }>
      {frame}

      <View style={styles.section}>
        <T variant="section">What it is</T>
        <View style={styles.chips}>
          {TYPES.map((t) => (
            <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />
          ))}
        </View>
        <TextField label="Name" value={title} onChangeText={setTitle} placeholder="e.g. Jubilee comprehensive cover" />
      </View>
      <Rule />
      <KeyValueRow
        label="Vehicle"
        value={vehicle ? `${vehicle.make} ${vehicle.model}` : 'None yet'}
        onPress={vehicles.length > 1 ? () => setSheet('vehicle') : undefined}
        valueColor={vehicles.length > 1 ? Colors.accent : undefined}
      />
      {hasExpiry ? (
        <KeyValueRow label="Expires" value={expiry ? formatDateWithYear(expiry) : 'Set a date'} valueColor={expiry ? undefined : Colors.accent} onPress={() => setSheet('expiry')} last />
      ) : null}
      <Footnote style={styles.note}>
        {hasExpiry ? 'CARMA REMINDS YOU 30 DAYS BEFORE IT RUNS OUT.' : 'RECEIPTS AND INVOICES HAVE NO EXPIRY. THEY STAY WITH THE VEHICLE’S HISTORY.'}
      </Footnote>
      {errorLine}

      <OptionSheet
        visible={sheet === 'vehicle'}
        title="Which vehicle?"
        options={vehicles.map((v) => ({ key: v.id, label: `${v.make} ${v.model}`, meta: `${v.year} · ${formatNumber(v.odometerKm)} KM`, glyph: v.type === 'motorcycle' ? 'motorcycle' : 'vehicle' }))}
        selected={vehicleId}
        onSelect={(k) => {
          setPickedVehicleId(k);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet visible={sheet === 'expiry'} value={expiry} title="Expires on" allowFuture onSelect={setExpiry} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: Spacing.md,
    gap: 10,
  },
  pickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  flex: {
    flex: 1,
  },
  frameWrap: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.chip,
    padding: Spacing.lg,
  },
  frame: {
    height: 150,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: Colors.accent,
  },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  section: {
    paddingVertical: Spacing.md,
    gap: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  note: {
    marginTop: Spacing.md,
  },
  error: {
    marginTop: Spacing.sm,
    fontFamily: FontFamily.medium,
  },
});
