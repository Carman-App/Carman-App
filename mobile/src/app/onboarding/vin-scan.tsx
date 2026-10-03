import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { vinFromBarcode } from '@/features/onboarding/vin';
import { Colors, Spacing } from '@/theme/tokens';

/**
 * Scan VIN: reads the barcode on the VIN sticker (driver's door jamb or the
 * windscreen). The VIN is then shown on the VIN screen to confirm before it
 * is saved, as the design says of anything read by the camera.
 */
export default function VinScanScreen() {
  const { update } = useOnboardingDraft();
  const [permission, requestPermission] = useCameraPermissions();
  const [note, setNote] = useState<string | null>(null);
  const done = useRef(false);

  const onScan = (r: BarcodeScanningResult) => {
    if (done.current) return;
    const vin = vinFromBarcode(r.data);
    if (!vin) {
      setNote('That code is not a VIN. Point at the barcode next to the 17 characters.');
      return;
    }
    done.current = true;
    update({ vin });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar backLabel="CLOSE" backGlyph="close" right="SCAN VIN" fallback="/onboarding/vin" />
      {Platform.OS === 'web' ? (
        <View style={styles.center}>
          <T variant="body" center>
            Scanning works in the app on your phone. Enter the VIN by hand here.
          </T>
        </View>
      ) : !permission ? null : !permission.granted ? (
        <View style={styles.center}>
          <T variant="body" center>
            Carma needs the camera to read the barcode on the VIN sticker.
          </T>
          <Button onPress={() => void requestPermission()}>Allow the camera</Button>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['code39', 'code128', 'datamatrix', 'qr', 'pdf417'] }}
            onBarcodeScanned={onScan}
          />
          <View style={styles.frame} pointerEvents="none">
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <View style={styles.scanLine} />
          </View>
        </View>
      )}
      <View style={styles.foot}>
        <T variant="eyebrow" color={note ? Colors.signal : Colors.slate} center>
          {note ?? 'VIN PLATE / DOOR JAMB · HOLD THE BARCODE INSIDE THE FRAME'}
        </T>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
  cameraWrap: {
    flex: 1,
    margin: Spacing.lg,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ink,
  },
  frame: {
    width: 260,
    height: 100,
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: Colors.white,
  },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  scanLine: {
    height: 2,
    marginHorizontal: 10,
    backgroundColor: Colors.signal,
  },
  foot: {
    padding: Spacing.lg,
  },
});
