import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { Spacing } from '@/theme/tokens';

type PlaceholderScreenProps = {
  title: string;
  section?: string;
  note?: string;
};

/**
 * Used for the 32 out-of-scope screens (57-88): Notifications, Settings, Billing,
 * the entire Mechanic side, etc. Real screen, real route, just not fleshed out this pass.
 */
export function PlaceholderScreen({ title, section, note }: PlaceholderScreenProps) {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.body}>
        <IconGlyph glyph="soon" size={56} />
        {section ? (
          <T variant="eyebrow" center>
            {section}
          </T>
        ) : null}
        <T variant="heading" center style={styles.title}>
          {title}
        </T>
        <T variant="body" color="#6F6C63" center style={styles.note}>
          {note ?? 'This screen is coming soon. It is wired into navigation so you can reach it, but the detailed UI has not been built yet.'}
        </T>
        {router.canGoBack() ? <Button variant="secondary" onPress={() => router.back()} style={styles.button}>Back</Button> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xxxl,
  },
  title: {
    marginTop: Spacing.xs,
  },
  note: {
    maxWidth: 300,
    marginTop: Spacing.xxs,
  },
  button: {
    marginTop: Spacing.lg,
    minWidth: 160,
  },
});
