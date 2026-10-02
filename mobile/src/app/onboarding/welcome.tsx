import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { useAccount, useOnboarded, useUiState } from '@/data/hooks';
import { Colors, Spacing, Tracking } from '@/theme/tokens';

/** Welcome. Google or Apple only; the three stripes are the Carma blue, signal red and yellow. */
export default function WelcomeScreen() {
  const onboarded = useOnboarded();
  const mode = useUiState('mode');
  const account = useAccount().data;
  const firstName = account?.name?.split(' ')[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Image source={require('@/../assets/images/welcome-car.jpg')} style={styles.photo} contentFit="cover" contentPosition={{ left: '38%', top: '58%' }} />
      <View style={styles.brand}>
        <View style={styles.dot} />
        <T style={styles.brandText}>CARMA</T>
      </View>
      <View style={styles.hero}>
        <T variant="hero">Every vehicle has a history. Most of it gets lost.</T>
        <T variant="body" style={styles.sub}>
          Know exactly what your car costs you, and prove every service it has had when you sell it.
        </T>
        <View style={styles.stripes}>
          <View style={[styles.stripe, { backgroundColor: Colors.accent }]} />
          <View style={[styles.stripe, { backgroundColor: Colors.signal }]} />
          <View style={[styles.stripe, { backgroundColor: Colors.cta }]} />
        </View>
      </View>
      <View style={styles.foot}>
        {onboarded ? (
          <>
            <Button onPress={() => router.replace(mode === 'mechanic' ? '/mechanic/dashboard' : '/home')}>
              {firstName ? `Continue as ${firstName}` : 'Continue'}
            </Button>
            <Button variant="secondary" size="md" onPress={() => router.push('/onboarding/country')}>
              Set up again
            </Button>
          </>
        ) : (
          <>
            <Button onPress={() => router.push('/onboarding/country')}>Get started</Button>
            <T variant="eyebrow" color={Colors.body} center style={styles.trial}>
              7 DAYS FREE · NO CARD TO START{'\n'}SUBSCRIBE AFTER THAT TO KEEP ADDING RECORDS
            </T>
          </>
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
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.14,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: Spacing.lg,
    paddingTop: 22,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  brandText: {
    fontSize: 10,
    letterSpacing: Tracking.brand,
    color: Colors.body,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sub: {
    marginTop: Spacing.lg,
    maxWidth: 300,
  },
  stripes: {
    flexDirection: 'row',
    gap: 10,
    height: 8,
    marginTop: Spacing.xl,
  },
  stripe: {
    flex: 1,
  },
  foot: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 14,
    gap: 14,
  },
  trial: {
    lineHeight: 16,
  },
});
