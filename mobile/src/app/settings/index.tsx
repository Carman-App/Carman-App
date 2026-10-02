import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Footnote, KeyValueRow, Toggle } from '@/components/ui/Blocks';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useActiveGarage, useUiState } from '@/data/hooks';
import { updateAccount } from '@/data/repo';
import { openLegal } from '@/features/auth/legal';
import { deleteAccount, signOut } from '@/features/auth/signIn';
import { setUiState } from '@/data/uiState';
import { COUNTRIES } from '@/features/onboarding/countries';
import { Colors, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

const NOTIFS = [
  { key: 'service', title: 'Service due', sub: 'MILEAGE AND TIME INTERVALS', glyph: 'service' },
  { key: 'docs', title: 'Document expiry', sub: 'INSURANCE · LICENCE · INSPECTION', glyph: 'insurance' },
  { key: 'jobs', title: 'Estimates and jobs', sub: 'WHEN A MECHANIC NEEDS YOU', glyph: 'estimate' },
  { key: 'money', title: 'Invoices and payments', sub: 'SENT · PAID · OVERDUE', glyph: 'invoice' },
  { key: 'members', title: 'Garage members', sub: 'JOINS · LEAVES · ACCESS REQUESTS', glyph: 'members' },
  { key: 'idle', title: 'Project stalled', sub: 'NO ENTRY FOR 14 DAYS', glyph: 'timeline' },
];

/** My profile: identity, region and units, notifications, garage, privacy and sign out. */
export default function MyProfileScreen() {
  const account = useAccount().data;
  const garage = useActiveGarage().data;
  const mode = useUiState('mode');
  const prefs = useUiState('notificationPrefs');
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const units = account ? REGION_UNITS[account.region] : undefined;
  const country = COUNTRIES.find((c) => c.region === account?.region);
  const on = (k: string) => prefs[k] ?? k !== 'idle';
  const onCount = NOTIFS.filter((n) => on(n.key)).length;

  return (
    <Screen padded={false} header={<TopBar backLabel="HOME" right="MY PROFILE" fallback="/home" />}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <T variant="display">{account?.name || 'Your profile'}</T>
          <T variant="eyebrow" color={Colors.slate}>
            {account?.email ?? ''}
          </T>
        </View>
        <Avatar name={account?.name ?? 'You'} size={52} />
      </View>
      <Pressable onPress={() => router.push('/profile-switch')} style={styles.switch}>
        <View style={styles.flex}>
          <T variant="bodyStrong">Switch profile</T>
          <T variant="eyebrow" color={Colors.slate}>
            {(account?.name.split(' ')[0] ?? 'YOU').toUpperCase()} · {mode === 'mechanic' ? 'MECHANIC' : 'PERSONAL'}
          </T>
        </View>
        <IconGlyph glyph="chevron-right" size={20} bg="transparent" fg={Colors.textFaint} />
      </Pressable>

      <SectionHeader title="REGION AND UNITS" tone="tag" rule inset />
      <View style={styles.pad}>
        <KeyValueRow tone="caps" label="Country" value={country?.name ?? '—'} onPress={() => setPicking(true)} valueColor={Colors.ink} />
        <KeyValueRow tone="caps" label="Currency" value={units?.currency ?? '—'} />
        <KeyValueRow tone="caps" label="Distance" value={units?.distance === 'mi' ? 'Miles' : 'Kilometres'} />
        <KeyValueRow tone="caps" label="Volume" value={units?.volume === 'gal' ? 'Gallons' : 'Litres'} />
        <KeyValueRow tone="caps" label="Date format" value="dd mm yyyy" last />
      </View>

      <SectionHeader title="NOTIFICATIONS" tone="tag" rule inset right={<T variant="eyebrow">{onCount} OF {NOTIFS.length} ON</T>} />
      {NOTIFS.map((n) => (
        <View key={n.key} style={styles.notif}>
          <IconGlyph glyph={n.glyph} size={32} shape="tile" />
          <View style={styles.flex}>
            <T variant="bodyStrong">{n.title}</T>
            <T variant="eyebrow" color={Colors.slate}>
              {n.sub}
            </T>
          </View>
          <Toggle value={on(n.key)} onValueChange={(v) => void setUiState({ notificationPrefs: { ...prefs, [n.key]: v } })} />
        </View>
      ))}

      <SectionHeader title="GARAGE AND ACCOUNT" tone="tag" rule inset />
      {[
        { label: garage ? `${garage.name} settings` : 'Garage settings', go: () => garage && router.push(`/garages/${garage.id}/settings`) },
        { label: 'Subscription and billing', go: () => router.push('/settings/billing') },
        { label: 'Offline and sync', go: () => router.push('/sync') },
      ].map((r) => (
        <Pressable key={r.label} onPress={r.go} style={styles.row}>
          <T variant="bodyStrong" style={styles.flex}>
            {r.label}
          </T>
          <IconGlyph glyph="chevron-right" size={20} bg="transparent" fg={Colors.textFaint} />
        </Pressable>
      ))}
      <Pressable
        onPress={async () => {
          await signOut();
          router.replace('/onboarding/welcome');
        }}
        style={styles.row}>
        <IconGlyph glyph="logout" size={22} bg="transparent" fg={Colors.signal} scale={0.85} />
        <T variant="bodyStrong" color={Colors.signal} style={styles.flex}>
          Sign out of this phone
        </T>
      </Pressable>

      <SectionHeader title="PRIVACY" tone="tag" rule inset />
      {[
        { label: 'Privacy policy', go: () => openLegal('privacy') },
        { label: 'Terms of use', go: () => openLegal('terms') },
      ].map((r) => (
        <Pressable key={r.label} onPress={r.go} style={styles.row}>
          <T variant="bodyStrong" style={styles.flex}>
            {r.label}
          </T>
          <IconGlyph glyph="chevron-right" size={20} bg="transparent" fg={Colors.textFaint} />
        </Pressable>
      ))}
      <Pressable onPress={() => setConfirmDelete(true)} style={styles.row}>
        <T variant="bodyStrong" color={Colors.signal} style={styles.flex}>
          Delete my account
        </T>
      </Pressable>

      <View style={styles.pad}>
        <Footnote color={Colors.textFaint} style={styles.version}>
          CARMA 1.0{garage?.location && garage.location !== 'Not set' ? ` · ${garage.location.split(',').pop()?.trim().toUpperCase()}` : ''}
        </Footnote>
      </View>

      <OptionSheet
        visible={confirmDelete}
        title="Delete your account?"
        lede="This signs you out on every device and deletes your account, garages, vehicles, records, documents and workshops. Everything is removed for good after 30 days; until then Carma support can undo it."
        options={[]}
        onSelect={() => {}}
        onClose={() => setConfirmDelete(false)}
        footer={
          <View style={styles.deleteButtons}>
            <Button
              variant="danger"
              loading={deleting}
              onPress={async () => {
                setDeleting(true);
                setDeleteError(null);
                const res = await deleteAccount();
                setDeleting(false);
                if (!res.ok) {
                  setDeleteError(res.message);
                  return;
                }
                setConfirmDelete(false);
                router.replace('/onboarding/welcome');
              }}>
              Delete my account
            </Button>
            <Button variant="secondary" size="md" onPress={() => setConfirmDelete(false)}>
              Keep my account
            </Button>
            {deleteError ? (
              <T variant="meta" color={Colors.signal} center>
                {deleteError}
              </T>
            ) : null}
          </View>
        }
      />

      <PickerSheet
        visible={picking}
        title="Pick a country"
        items={COUNTRIES.map((c) => `${c.flag}  ${c.name}`)}
        selected={country ? `${country.flag}  ${country.name}` : undefined}
        searchPlaceholder="Country or currency"
        onSelect={(v) => {
          const c = COUNTRIES.find((x) => `${x.flag}  ${x.name}` === v);
          setPicking(false);
          if (c) void updateAccount({ region: c.region });
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deleteButtons: {
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  flex: {
    flex: 1,
    gap: 6,
  },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  notif: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  version: {
    paddingVertical: Spacing.lg,
  },
});
