import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { cleanVin } from '@/features/onboarding/vin';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';

const WHY = ['Confirms exact specification', 'Identifies compatible parts', 'Surfaces manufacturer recalls', 'Builds a verifiable history'];

/**
 * VIN: optional and encouraged (design screen "VIN + powertrain"). Scan VIN
 * reads the barcode on the VIN sticker; Enter manually types it; Not now and
 * SKIP go on to the first odometer. A scanned VIN is shown here to confirm.
 */
export default function VinScreen() {
  const { draft, update } = useOnboardingDraft();
  const [manual, setManual] = useState(!!draft.vin);
  const clean = cleanVin(draft.vin);
  const valid = clean.length === 17;
  const toOdometer = () => router.push('/onboarding/odometer');
  // Design: SKIP and Not now go to the odometer once the vehicle is complete, else back to it.
  const vehicleComplete = !!draft.make && !!draft.model && !!draft.year && !!draft.powertrain && !!draft.transmission;
  const skip = () => (vehicleComplete ? toOdometer() : router.back());

  return (
    <OnboardingScreen
      backLabel="BACK"
      right="SKIP"
      onRight={skip}
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
          <View style={styles.buttons}>
            <Button disabled={!valid} onPress={vehicleComplete ? toOdometer : () => router.back()}>
              {valid ? 'Continue' : `${clean.length} of 17 characters`}
            </Button>
            <View style={styles.row}>
              <Button style={styles.half} onPress={() => router.push('/onboarding/vin-scan')} glyph="qr">
                Scan VIN
              </Button>
              <Button style={styles.half} onPress={skip}>
                Not now
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.buttons}>
            <Button glyph="qr" onPress={() => router.push('/onboarding/vin-scan')}>
              Scan VIN
            </Button>
            <View style={styles.row}>
              <Button style={styles.half} onPress={() => setManual(true)}>
                Enter manually
              </Button>
              <Button style={styles.half} onPress={skip}>
                Not now
              </Button>
            </View>
          </View>
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
            autoFocus={!draft.vin}
            helper={draft.vin && valid ? 'Check it matches the plate before you continue.' : 'On the plate inside the driver’s door, at the base of the windscreen, or on the logbook.'}
          />
        ) : (
          <View style={styles.frameBox}>
            <View style={styles.frame}>
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs>
                  <Pattern id="hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <Line x1={0} y1={0} x2={0} y2={8} stroke="rgba(19,75,156,0.12)" strokeWidth={1.5} />
                  </Pattern>
                </Defs>
                <Rect x={0} y={0} width="100%" height="100%" fill="url(#hatch)" />
              </Svg>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
              <View style={styles.scanLine} />
            </View>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  frameBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 14,
  },
  frame: {
    width: 200,
    height: 76,
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: Colors.accent,
  },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  scanLine: {
    height: 2,
    backgroundColor: Colors.accent,
  },
  frameLabel: {
    fontFamily: FontFamily.regular,
  },
  buttons: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
});
