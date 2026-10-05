import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { useAccount } from '@/data/hooks';
import { daysLeft } from '@/features/billing/plan';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { COUNTRIES } from '@/features/onboarding/countries';
import { formatNumber } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

const POWER_LABEL: Record<string, string> = { petrol: 'PETROL', diesel: 'DIESEL', hybrid: 'HYBRID', electric: 'ELECTRIC', 'plug-in-hybrid': 'PLUG-IN HYBRID', other: 'OTHER' };
const TRANS_LABEL: Record<string, string> = { manual: 'MANUAL', automatic: 'AUTOMATIC', 'semi-auto': 'SEMI-AUTO' };

/** Garage ready: a receipt of what was created, then three next steps that each earn their place. */
export default function GarageReadyScreen() {
  const { draft } = useOnboardingDraft();
  const planState = useAccount().data?.planState;
  const trialLabel = planState?.state === 'trial' ? `${daysLeft(planState.trialEndsAt)} DAYS FREE` : 'FREE TRIAL';
  const currency = REGION_UNITS[draft.region].currency;
  const country = COUNTRIES.find((c) => c.region === draft.region)?.name ?? '';
  const vehicleId = draft.vehicleId;
  const both = draft.profile === 'both';
  const next = [
    { label: 'Add a fuel record', glyph: 'fuel', go: () => router.push({ pathname: '/record/expense', params: { categoryKey: 'fuel', ...(vehicleId ? { vehicleId } : {}) } }) },
    { label: 'Add a service record', glyph: 'service', go: () => router.push({ pathname: '/record/expense', params: { categoryKey: 'service', ...(vehicleId ? { vehicleId } : {}) } }) },
    { label: 'Add insurance document', glyph: 'insurance', go: () => router.push({ pathname: '/doc/scan', params: vehicleId ? { vehicleId } : {} }) },
  ];
  const summary = [
    `${draft.make} ${draft.model} · ${draft.year ?? ''}`.trim(),
    draft.powertrain ? POWER_LABEL[draft.powertrain] : null,
    draft.transmission ? TRANS_LABEL[draft.transmission] : null,
    draft.usage === 'project' ? 'PROJECT' : 'DAILY',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <View style={styles.head}>
          <T variant="eyebrow" color={Colors.accent}>
            VEHICLE ADDED
          </T>
          <T variant="display">{draft.model || 'Your vehicle'} is in your garage</T>
          <T variant="eyebrow" color={Colors.slate} style={styles.meta}>
            {summary}
            {'\n'}
            {formatNumber(draft.odometerKm)} {draft.unit.toUpperCase()} · {country}
          </T>
        </View>
        <View style={styles.list}>
          <T variant="eyebrowStrong" style={styles.listHead}>
            START THE HISTORY
          </T>
          {next.map((n) => (
            <Pressable accessibilityRole="button" key={n.label} onPress={n.go} style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.accentSoft }]}>
              <IconGlyph glyph={n.glyph} size={32} shape="tile" />
              <T variant="bodyStrong" style={styles.flex}>
                {n.label}
              </T>
              <IconGlyph glyph="arrow-right" size={20} bg="transparent" fg={Colors.textFaint} scale={0.9} />
            </Pressable>
          ))}
          <View style={styles.note}>
            <Footnote>NOTHING ELSE IS REQUIRED. ADD RECORDS WHEN THEY HAPPEN AND CARMA KEEPS THE HISTORY IN ORDER.</Footnote>
          </View>
        </View>
      </ScrollView>
      <View style={styles.foot}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/insights')} style={({ pressed }) => [styles.trial, pressed && { backgroundColor: Colors.ctaPressed }]}>
          <IconGlyph glyph="soon" size={20} bg="transparent" fg={Colors.ink} scale={0.85} />
          <T variant="eyebrow" color={Colors.ink} style={styles.flex} numberOfLines={1}>
            {trialLabel} · {(draft.garageName.trim() || 'MY GARAGE').toUpperCase()} · {currency}
          </T>
          <IconGlyph glyph="arrow-right" size={20} bg="transparent" fg={Colors.ink} scale={0.85} />
        </Pressable>
        {both ? (
          <Button onPress={() => router.push('/onboarding/workshop')}>Set up my workshop</Button>
        ) : (
          <Button onPress={() => router.replace(vehicleId ? `/vehicle/${vehicleId}/timeline` : '/home')}>See my timeline</Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
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
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cta,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
  },
});
