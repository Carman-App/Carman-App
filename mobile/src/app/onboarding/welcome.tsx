import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  return (
    <Screen
      footer={
        <View style={styles.footerWrap}>
          <Button onPress={() => router.push('/onboarding/country')}>Continue with Apple</Button>
          <Button variant="secondary" onPress={() => router.push('/onboarding/country')}>
            Continue with Google
          </Button>
          <T variant="meta" center style={styles.legal}>
            By creating an account on Carma you agree to the Terms of Service and Privacy Policy.
          </T>
        </View>
      }>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <T variant="eyebrowStrong">CARMA</T>
        </View>
        <T variant="display" style={styles.headline}>
          Every vehicle has a history. Most of it gets lost.
        </T>
        <T variant="body" color={Colors.textMuted} style={styles.sub}>
          Know exactly what your car costs you, and prove every service it has had when you sell it.
        </T>
      </View>
      <View style={styles.trialCard}>
        <T variant="bodyStrong">7 days free · no card to start</T>
        <T variant="meta">Subscribe after that to keep adding records</T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: Spacing.xxxl,
    gap: Spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentSoft,
    marginBottom: Spacing.md,
  },
  headline: {
    fontSize: 32,
  },
  sub: {
    marginTop: Spacing.xs,
  },
  trialCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 2,
    marginBottom: Spacing.lg,
  },
  footerWrap: {
    gap: Spacing.sm,
  },
  legal: {
    marginTop: Spacing.xxs,
  },
});
