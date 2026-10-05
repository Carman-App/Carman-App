import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { useActiveWorkshop } from '@/data/hooks';
import { setUiState } from '@/data/uiState';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';

// Design (screen "First job"): rows open the job board, the third a new job.
const STEPS = [
  { title: 'Add a customer', body: 'A name and a phone number is enough to start.', href: '/mechanic/add-customer' },
  { title: 'Add their vehicle', body: 'Registration, make and model. The owner can connect it to their own garage later.', href: '/mechanic/job-board' },
  { title: 'Open the first job', body: 'Reported problem, estimate, then the invoice when the work is done.', href: '/mechanic/new-job' },
] as const;

/** First job: the activation path stays visible without blocking entry to the app. */
export default function FirstJobScreen() {
  const { draft } = useOnboardingDraft();
  const workshop = useActiveWorkshop().data;
  const name = workshop?.name ?? (draft.businessName || 'Your workshop');

  return (
    <OnboardingScreen
      backLabel="BACK"
      step={{ step: 2, total: 2, label: 'WORKSHOP' }}
      title={`${name} is open`}
      lede="Three steps put the first job on the board. None of them block you."
      bleed
      footer={
        <>
          <Button onPress={() => router.replace('/mechanic/dashboard')}>Open the workshop</Button>
          <Pressable accessibilityRole="button"
            hitSlop={8}
            onPress={async () => {
              await setUiState({ mode: 'owner' });
              // A mechanic-only account has no garage yet: start one.
              router.replace(draft.profile === 'both' ? '/home' : '/garages/add');
            }}>
            <T variant="meta" color={Colors.textFaint} center>
              Back to my own garage
            </T>
          </Pressable>
        </>
      }>
      {STEPS.map((s, i) => (
        <Pressable accessibilityRole="button" key={s.title} onPress={() => router.push(s.href)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: Colors.accentSoft }]}>
          <View style={[styles.num, i === 0 && styles.numOn]}>
            <T style={[styles.numText, i === 0 && { color: Colors.white }]}>{i + 1}</T>
          </View>
          <View style={styles.flex}>
            <T variant="bodyStrong">{s.title}</T>
            <T variant="meta" color={Colors.slate}>
              {s.body}
            </T>
          </View>
          <T variant="eyebrow" color={i === 0 ? Colors.positive : Colors.textFaint}>
            {i === 0 ? 'READY' : 'NEXT'}
          </T>
        </Pressable>
      ))}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  num: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numOn: {
    backgroundColor: Colors.accent,
  },
  numText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: Colors.accent,
  },
  flex: {
    flex: 1,
    gap: 6,
  },
});
