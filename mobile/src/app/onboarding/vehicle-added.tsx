import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { useAccount } from '@/data/hooks';
import { daysLeft } from '@/features/billing/plan';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { formatNumber } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import { REGION_UNITS, USAGE_LABEL } from '@/types/domain';

/** Garage ready: a receipt of what was created, then three next steps that each earn their place. */
export default function GarageReadyScreen() {
  const { draft } = useOnboardingDraft();
  const planState = useAccount().data?.planState;
  const trialLabel = planState?.state === 'trial' ? `${daysLeft(planState.trialEndsAt)} DAYS FREE` : 'FREE TRIAL';
  const units = REGION_UNITS[draft.region];
  const vehicleId = draft.vehicleId;
  const next = [
    { label: 'Add a fuel record', glyph: 'fuel', go: () => router.push({ pathname: '/record/expense', params: { categoryKey: 'fuel', ...(vehicleId ? { vehicleId } : {}) } }) },
    { label: 'Add a service record', glyph: 'service', go: () => router.push({ pathname: '/record/expense', params: { categoryKey: 'service', ...(vehicleId ? { vehicleId } : {}) } }) },
    { label: 'Add insurance document', glyph: 'insurance', go: () => router.push({ pathname: '/doc/scan', params: vehicleId ? { vehicleId } : {} }) },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.head}>
        <T variant="eyebrow" color={Colors.accent}>
          VEHICLE ADDED
        </T>
        <T variant="display">{draft.model || 'Your vehicle'} is in your garage</T>
        <T variant="eyebrow" color={Colors.slate} style={styles.meta}>
          {[draft.make, draft.model, draft.year, draft.powertrain?.toUpperCase(), draft.transmission?.toUpperCase(), USAGE_LABEL[draft.usage]].filter(Boolean).join(' · ')}
          {'\n'}
          {formatNumber(draft.odometerKm)} {units.distance.toUpperCase()} · {draft.garageName.toUpperCase() || 'MY GARAGE'}
        </T>
      </View>
      <View style={styles.list}>
        <T variant="eyebrowStrong" style={styles.listHead}>
          START THE HISTORY
        </T>
        {next.map((n) => (
          <Pressable key={n.label} onPress={n.go} style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.accentSoft }]}>
            <IconGlyph glyph={n.glyph} size={28} shape="tile" />
            <T variant="bodyStrong">{n.label}</T>
          </Pressable>
        ))}
        <View style={styles.note}>
          <Footnote>NOTHING ELSE IS REQUIRED. ADD RECORDS WHEN THEY HAPPEN AND CARMA KEEPS THE HISTORY IN ORDER.</Footnote>
        </View>
      </View>
      <View style={styles.foot}>
        <View style={styles.trial}>
          <T variant="eyebrow" color={Colors.ink}>
            {trialLabel} · {(draft.garageName || 'MY GARAGE').toUpperCase()} · {units.currency}
          </T>
        </View>
        {draft.profile === 'both' ? (
          <Button variant="secondary" size="md" onPress={() => router.push('/onboarding/workshop')}>
            Set up the workshop next
          </Button>
        ) : null}
        <Button onPress={() => router.replace(vehicleId ? `/vehicle/${vehicleId}/timeline` : '/home')}>See my timeline</Button>
        <Pressable onPress={() => router.replace('/home')} hitSlop={8}>
          <T variant="meta" center>
            Go to Home
          </T>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  head: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 10,
  },
  meta: {
    lineHeight: 18,
  },
  list: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  listHead: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  note: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  foot: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 10,
  },
  trial: {
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
