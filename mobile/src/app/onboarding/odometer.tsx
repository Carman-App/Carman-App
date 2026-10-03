import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { completeOnboarding } from '@/data/repo';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { formatNumber } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

// Design scale: a label every 1,000, 70px apart; ten ticks between labels.
const UNIT_PER_TICK = 100;
const TICK_W = 7;
const SEGMENT = 10; // ticks per labelled segment (1,000)
const SEGMENT_W = SEGMENT * TICK_W;
const SEGMENTS = 1000; // 0 – 1,000,000
const STEPS = [100, 1000, 10000, 100000];
const KM_PER_MI = 1.609344;

/** First odometer: the reading every distance reminder and cost per km is measured from. */
export default function OdometerScreen() {
  const { draft, update } = useOnboardingDraft();
  // The reading is kept in the unit on screen (draft.unit) and saved in km.
  const unit = draft.unit;
  const UNIT = unit.toUpperCase();
  const reading = draft.odometerKm;
  const [scaleWidth, setScaleWidth] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragging = useRef(false);
  const scroller = useRef<FlatList<number>>(null);

  const setReading = (v: number, moveScale = true) => {
    const next = Math.max(0, Math.min(9_999_999, Math.round(v)));
    update({ odometerKm: next });
    if (moveScale) scroller.current?.scrollToOffset({ offset: (Math.min(next, SEGMENTS * 1000) / UNIT_PER_TICK) * TICK_W, animated: true });
  };

  // Start the scale at the reading already entered (e.g. when coming back to this step).
  useEffect(() => {
    if (scaleWidth > 0 && reading > 0) {
      scroller.current?.scrollToOffset({ offset: (Math.min(reading, SEGMENTS * 1000) / UNIT_PER_TICK) * TICK_W, animated: false });
    }
    // Only when the scale first gets its size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleWidth]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!dragging.current) return;
    setReading((e.nativeEvent.contentOffset.x / TICK_W) * UNIT_PER_TICK, false);
  };

  const finish = async () => {
    if (reading <= 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const vehicle = await completeOnboarding({
        name: draft.name,
        email: draft.email,
        region: draft.region,
        profile: draft.profile ?? 'owner',
        garageName: draft.garageName,
        garageLocation: draft.garageLocation,
        vehicle: {
          type: draft.vehicleType ?? 'car',
          usage: draft.usage ?? 'daily',
          make: draft.make,
          model: draft.model,
          variant: draft.variant,
          year: draft.year ?? new Date().getFullYear(),
          odometerKm: unit === 'mi' ? Math.round(reading * KM_PER_MI) : reading,
          powertrain: draft.powertrain,
          transmission: draft.transmission,
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

  const has = reading > 0;

  return (
    <OnboardingScreen
      backLabel="BACK"
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
          <Button disabled={!has} loading={saving} onPress={finish}>
            {has ? `Save vehicle · ${formatNumber(reading)} ${unit}` : 'Enter the reading'}
          </Button>
        </>
      }>
      <View style={styles.pad}>
        <View style={styles.readingRow}>
          <View style={styles.flex}>
            <TextInput
              value={has ? formatNumber(reading) : ''}
              onChangeText={(v) => setReading(Number(v.replace(/\D/g, '').slice(0, 7)) || 0)}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              style={styles.reading}
            />
            <T variant="eyebrow" color={Colors.slate}>
              {has ? `READING TODAY · ${UNIT}` : 'DRAG THE SCALE OR TAP A STEP TO ADD IT'}
            </T>
          </View>
          <Pressable onPress={() => update({ unit: unit === 'mi' ? 'km' : 'mi' })} hitSlop={8} style={styles.unit} accessibilityLabel="Switch kilometres and miles">
            <View style={styles.switchRow}>
              <IconGlyph glyph="swap" size={16} bg="transparent" fg={Colors.slate} scale={0.9} />
              <T variant="eyebrow" color={Colors.slate}>
                SWITCH
              </T>
            </View>
            <T variant="eyebrowStrong" color={Colors.accent} style={styles.unitValue}>
              {UNIT}
            </T>
          </Pressable>
        </View>
        <T variant="lede" style={styles.lede}>
          Carma uses your odometer to track maintenance intervals, running costs and history.
        </T>
      </View>

      <View style={styles.scaleWrap} onLayout={(e) => setScaleWidth(e.nativeEvent.layout.width)}>
        <View style={styles.padHead}>
          <Pressable onPress={() => setReading(0)} style={styles.circle} accessibilityLabel="Clear the reading">
            <IconGlyph glyph="swap" size={44} bg="transparent" fg={has ? Colors.signal : Colors.textFaint} scale={0.45} />
          </Pressable>
          <T variant="eyebrow" color={Colors.slate}>
            {UNIT}
          </T>
          <Pressable onPress={finish} style={styles.circle} accessibilityLabel="Save the reading">
            <IconGlyph glyph="check" size={44} bg="transparent" fg={has ? Colors.accent : Colors.textFaint} scale={0.45} />
          </Pressable>
        </View>
        <FlatList
          ref={scroller}
          horizontal
          data={SEGMENT_INDEXES}
          keyExtractor={(i) => String(i)}
          getItemLayout={(_, index) => ({ length: SEGMENT_W, offset: SEGMENT_W * index, index })}
          initialNumToRender={12}
          windowSize={7}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => (dragging.current = true)}
          onMomentumScrollEnd={() => (dragging.current = false)}
          onScrollEndDrag={() => setTimeout(() => (dragging.current = false), 200)}
          onScroll={onScroll}
          contentContainerStyle={{ paddingHorizontal: Math.max(0, scaleWidth / 2 - SEGMENT_W / 2) }}
          // Each segment is centred on its labelled value (major tick in the middle),
          // so labels never hang over a segment's edge.
          renderItem={({ item }) => (
            <View style={styles.segment}>
              <View style={styles.ticks}>
                {Array.from({ length: SEGMENT }).map((_, t) => (
                  <View key={t} style={styles.tickCell}>
                    <View style={[styles.tick, t === SEGMENT / 2 ? styles.tickMajor : t === 0 ? styles.tickMid : null]} />
                  </View>
                ))}
              </View>
              <T variant="small" style={styles.tickLabel} numberOfLines={1}>
                {formatNumber(item * SEGMENT * UNIT_PER_TICK)}
              </T>
            </View>
          )}
        />
        <View pointerEvents="none" style={[styles.needle, { left: scaleWidth / 2 - 1 }]} />
      </View>

      <View style={[styles.pad, styles.steps]}>
        {STEPS.map((s) => (
          <Pressable key={s} onPress={() => setReading(reading + s)} style={({ pressed }) => [styles.step, pressed && { backgroundColor: Colors.accentSoft }]}>
            <T variant="small" color={Colors.ink}>
              +{formatNumber(s)}
            </T>
          </Pressable>
        ))}
      </View>
      <T variant="eyebrow" color={Colors.slate} style={[styles.pad, styles.orDrag]}>
        OR DRAG THE SCALE
      </T>
    </OnboardingScreen>
  );
}

const SEGMENT_INDEXES = Array.from({ length: SEGMENTS + 1 }, (_, i) => i);

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  flex: {
    flex: 1,
    gap: Spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  padHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    width: SEGMENT_W,
    gap: 8,
  },
  orDrag: {
    marginTop: Spacing.md,
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
    width: SEGMENT_W,
    textAlign: 'center',
    color: Colors.slate,
  },
  needle: {
    position: 'absolute',
    top: 72,
    width: 2,
    height: 48,
    backgroundColor: Colors.signal,
  },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.lg,
  },
  step: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
