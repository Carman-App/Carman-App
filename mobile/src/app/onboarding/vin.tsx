import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';

const WHY = ['Confirms exact specification', 'Identifies compatible parts', 'Surfaces manufacturer recalls', 'Builds a verifiable history'];

/** VIN: optional and encouraged. 17 characters from the plate on the door jamb. */
export default function VinScreen() {
  const { draft, update } = useOnboardingDraft();
  const [manual, setManual] = useState(!!draft.vin);
  const clean = draft.vin.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
  const valid = clean.length === 17;

  return (
    <OnboardingScreen
      backLabel="BACK"
      right="SKIP"
      onRight={() => router.push('/onboarding/odometer')}
      above={
        <View style={styles.badge}>
          <T variant="eyebrowStrong" color={Colors.white}>
            OPTIONAL
          </T>
        </View>
      }
      title="Add your VIN"
      lede="Your VIN tells Carma exactly which vehicle you own, down to the engine."
      bleed
      footer={
        manual ? (
          <Button disabled={!valid} onPress={() => router.push('/onboarding/odometer')}>
            {valid ? 'Continue' : `${clean.length} of 17 characters`}
          </Button>
        ) : (
          <>
            <Button onPress={() => setManual(true)}>Enter the VIN</Button>
            <Button variant="secondary" size="md" onPress={() => router.push('/onboarding/odometer')}>
              Not now
            </Button>
          </>
        )
      }>
      {WHY.map((w) => (
        <View key={w} style={styles.why}>
          <View style={styles.square} />
          <T variant="body" color={Colors.ink}>
            {w}
          </T>
        </View>
      ))}
      <View style={styles.frameWrap}>
        {manual ? (
          <TextField
            value={draft.vin}
            onChangeText={(v) => update({ vin: v.toUpperCase() })}
            placeholder="17 characters"
            autoCapitalize="characters"
            autoFocus
            helper="On the plate inside the driver’s door, at the base of the windscreen, or on the logbook."
          />
        ) : (
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <View style={styles.scanLine} />
            <T variant="eyebrow" color={Colors.slate} style={styles.frameLabel}>
              VIN PLATE / DOOR JAMB
            </T>
          </View>
        )}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  why: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  square: {
    width: 6,
    height: 6,
    backgroundColor: Colors.accent,
  },
  frameWrap: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  frame: {
    alignSelf: 'center',
    width: 170,
    height: 64,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: Colors.accent,
  },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  scanLine: {
    height: 2,
    backgroundColor: Colors.accent,
    marginHorizontal: 8,
  },
  frameLabel: {
    position: 'absolute',
    bottom: -26,
    alignSelf: 'center',
    fontFamily: FontFamily.regular,
  },
});
