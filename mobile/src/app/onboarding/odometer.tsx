import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { completeOnboarding } from '@/data/repo';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { formatNumber } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

const STEP_KM = 500;
const TICK_W = 6;
const TICKS = 600; // 0 – 300,000
const STEPS = [100, 1000, 10000, 100000];

/** First odometer: the reading every distance reminder and cost per km is measured from. */
export default function OdometerScreen() {
  const { draft, update } = useOnboardingDraft();
  const unit = REGION_UNITS[draft.region]?.distance ?? 'km';
  const [scaleWidth, setScaleWidth] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef(false);
  const scroller = useRef<ScrollView>(null);

  const setReading = (km: number, moveScale = true) => {
    const v = Math.max(0, Math.min(9_999_999, Math.round(km)));
    update({ odometerKm: v });
    if (moveScale) scroller.current?.scrollTo({ x: Math.min(TICKS, v / STEP_KM) * TICK_W, animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    setReading((e.nativeEvent.contentOffset.x / TICK_W) * STEP_KM, false);
  };

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      const vehicle = await completeOnboarding({
        name: draft.name,
        email: draft.email,
        region: draft.region,
        profile: draft.profile,
        garageName: draft.garageName,
        garageLocation: draft.garageLocation,
        vehicle: {
          type: draft.vehicleType,
          usage: draft.usage,
          make: draft.make,
          model: draft.model,
          variant: draft.variant,
          year: draft.year,
          odometerKm: draft.odometerKm,
          powertrain: draft.powertrain,
          vin: draft.vin,
        },
      });
      update({ vehicleId: vehicle.id });
      router.push('/onboarding/vehicle-added');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      step={{ step: 6, total: 6 }}
      title="What’s on the odometer?"
      bleed
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={draft.odometerKm <= 0} loading={saving} onPress={finish}>
            {draft.odometerKm > 0 ? 'Continue' : 'Enter the reading'}
          </Button>
        </>
      }>
      <View style={styles.pad}>
        <View style={styles.readingRow}>
          <TextInput
            value={draft.odometerKm ? formatNumber(draft.odometerKm) : ''}
            onChangeText={(v) => setReading(Number(v.replace(/\D/g, '')) || 0)}
            placeholder="0"
            placeholderTextColor={Colors.chipStrong}
            keyboardType="number-pad"
            style={styles.reading}
          />
          <View style={styles.unit}>
            <T variant="eyebrow" color={Colors.slate}>
              UNIT
            </T>
            <T variant="eyebrowStrong" color={Colors.accent} style={styles.unitValue}>
              {unit.toUpperCase()}
            </T>
          </View>
        </View>
        <T variant="eyebrow" color={Colors.slate}>
          DRAG THE SCALE OR TAP A STEP TO ADD IT
        </T>
        <T variant="lede" style={styles.lede}>
          Carma uses your odometer to track maintenance intervals, running costs and history.
        </T>
      </View>

      <View style={styles.scaleWrap} onLayout={(e) => setScaleWidth(e.nativeEvent.layout.width)}>
        <T variant="eyebrow" center color={Colors.slate} style={styles.scaleUnit}>
          {unit.toUpperCase()}
        </T>
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => (dragging.current = true)}
          onMomentumScrollEnd={() => (dragging.current = false)}
          onScrollEndDrag={() => setTimeout(() => (dragging.current = false), 200)}
          onScroll={onScroll}
          contentContainerStyle={{ paddingHorizontal: scaleWidth / 2 }}>
          <View style={styles.ticks}>
            {Array.from({ length: TICKS + 1 }).map((_, i) => (
              <View key={i} style={styles.tickCell}>
                <View style={[styles.tick, i % 10 === 0 ? styles.tickMajor : i % 5 === 0 ? styles.tickMid : null]} />
                {i % 10 === 0 ? (
                  <T variant="small" style={styles.tickLabel} numberOfLines={1}>
                    {formatNumber(i * STEP_KM)}
                  </T>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
        <View pointerEvents="none" style={[styles.needle, { left: scaleWidth / 2 - 1 }]} />
      </View>

      <View style={[styles.pad, styles.steps]}>
        {STEPS.map((s) => (
          <Pressable key={s} onPress={() => setReading(draft.odometerKm + s)} style={({ pressed }) => [styles.step, pressed && { backgroundColor: Colors.accentSoft }]}>
            <T variant="small" color={Colors.ink}>
              +{formatNumber(s)}
            </T>
          </Pressable>
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  reading: {
    outlineWidth: 0,
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: 44,
    letterSpacing: -1,
    color: Colors.body,
    padding: 0,
  },
  unit: {
    alignItems: 'flex-end',
    gap: 6,
  },
  unitValue: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingBottom: 2,
  },
  lede: {
    marginTop: Spacing.lg,
    maxWidth: 260,
  },
  scaleWrap: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  scaleUnit: {
    marginBottom: Spacing.md,
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tickCell: {
    width: TICK_W,
    alignItems: 'flex-start',
  },
  tick: {
    width: 1,
    height: 18,
    backgroundColor: Colors.lineStrong,
  },
  tickMid: {
    height: 24,
    backgroundColor: Colors.slate,
  },
  tickMajor: {
    height: 32,
    backgroundColor: Colors.accent,
  },
  tickLabel: {
    position: 'absolute',
    top: 40,
    width: 60,
    marginLeft: -30,
    textAlign: 'center',
  },
  needle: {
    position: 'absolute',
    top: 44,
    width: 2,
    height: 48,
    backgroundColor: Colors.signal,
  },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.xl,
  },
  step: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
