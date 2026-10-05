import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useActiveGarage, useGarageMembers, useGarages, useUiState, useVehicles, useWorkshops } from '@/data/hooks';
import { setUiState } from '@/data/uiState';
import { planMeta } from '@/features/billing/plan';
import { Colors, Spacing } from '@/theme/tokens';

/** Switch profile: which profile Carma is being used as. Opened from My profile or the drawer. */
export default function SwitchProfileScreen() {
  const account = useAccount().data;
  const mode = useUiState('mode');
  const activeWorkshopId = useUiState('activeWorkshopId');
  const garages = useGarages().data ?? [];
  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const members = useGarageMembers(garage?.id).data ?? [];
  const workshops = useWorkshops().data ?? [];
  const [choice, setChoice] = useState<string>(mode === 'mechanic' ? (activeWorkshopId ?? workshops[0]?.id ?? 'owner') : 'owner');
  const first = account?.name.trim().split(' ')[0] || 'Personal';

  const options = [
    { key: 'owner', name: first, meta: `PERSONAL · ${vehicles.length} VEHICLE${vehicles.length === 1 ? '' : 'S'} · ${garages.length} GARAGE${garages.length === 1 ? '' : 'S'}` },
    ...workshops.map((w) => ({ key: w.id, name: w.name, meta: 'MECHANIC · WORKSHOP' })),
  ];
  const current = mode === 'mechanic' ? (activeWorkshopId ?? workshops[0]?.id) : 'owner';
  const picked = options.find((o) => o.key === choice);

  const apply = async () => {
    if (choice === 'owner') {
      await setUiState({ mode: 'owner' });
      router.replace('/home');
    } else {
      await setUiState({ mode: 'mechanic', activeWorkshopId: choice });
      router.replace('/mechanic/dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar backGlyph="close" backLabel="USING CARMA AS" />
      <ScrollView style={styles.list}>
        {options.map((o) => (
          <Pressable accessibilityRole="button" key={o.key} onPress={() => setChoice(o.key)} style={[styles.option, choice === o.key && styles.optionOn]}>
            {choice === o.key ? <View style={styles.bar} /> : null}
            <View style={[styles.flex, styles.indent]}>
              <T variant="heading" style={styles.name}>
                {o.name}
              </T>
              <T variant="eyebrow" color={Colors.slate}>
                {o.meta}
              </T>
            </View>
            <View style={[styles.radio, choice === o.key && styles.radioOn]}>{choice === o.key ? <View style={styles.dot} /> : null}</View>
          </Pressable>
        ))}
        {workshops.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding/workshop')} style={styles.option}>
            <View style={styles.flex}>
              <T variant="heading" style={[styles.name, { color: Colors.accent }]}>
                Add a workshop
              </T>
              <T variant="eyebrow" color={Colors.slate}>
                RUN JOBS, ESTIMATES AND INVOICES
              </T>
            </View>
          </Pressable>
        ) : null}
        <T variant="eyebrowStrong" style={styles.account}>
          ACCOUNT
        </T>
        {[
          { label: 'Garage members', meta: account?.planState?.limits.seats != null ? `${members.length} OF ${account.planState.limits.seats}` : String(members.length), go: () => garage && router.push(`/garages/${garage.id}/members`) },
          { label: 'Country & units', meta: account ? account.region : '', go: () => router.push('/settings') },
          { label: 'Subscription', meta: planMeta(account?.planState), go: () => router.push('/settings/billing') },
        ].map((r) => (
          <Pressable accessibilityRole="button" key={r.label} onPress={r.go} style={styles.row}>
            <T variant="body" color={Colors.ink} style={styles.flex}>
              {r.label}
            </T>
            <T variant="eyebrow" color={Colors.slate}>
              {r.meta}
            </T>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.foot}>
        <Button onPress={apply}>{choice === current ? `Stay as ${picked?.name ?? first}` : `Switch to ${picked?.name ?? ''}`}</Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    flex: 1,
  },
  flex: {
    flex: 1,
    gap: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  optionOn: {
    backgroundColor: Colors.surfaceWarm,
  },
  bar: {
    position: 'absolute',
    left: Spacing.lg,
    top: Spacing.lg,
    bottom: Spacing.lg,
    width: 2,
    backgroundColor: Colors.accent,
  },
  name: {
    fontSize: 22,
  },
  indent: {
    paddingLeft: Spacing.sm,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.chipStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: Colors.accent,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  account: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    gap: Spacing.sm,
  },
  foot: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
});
