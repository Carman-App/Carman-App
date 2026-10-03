import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Avatar } from '@/components/ui/Avatar';
import { Footnote, ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/data/api/client';
import { getTestAccountId, setTestAccountId } from '@/data/auth/testAccount';
import { queryClient } from '@/data/queryClient';
import { setUiState } from '@/data/uiState';
import { clearProgress } from '@/features/onboarding/progress';
import { Colors, Spacing } from '@/theme/tokens';

type TestAccount = { id: string; name: string; email: string; summary: string; mode: 'owner' | 'mechanic'; setUp: boolean };

/**
 * Development only: act as one of the test accounts (admin `npm run
 * test-accounts`) to try the app as different people without signing in.
 * Switching forgets this device's local state and opens the app as that
 * person would see it: set-up for a new account, otherwise their home.
 */
export default function TestAccountsScreen() {
  const query = useQuery({ queryKey: ['dev-test-accounts'], queryFn: () => api.get<TestAccount[]>('dev/test-accounts') });
  const [current, setCurrent] = useState(getTestAccountId());

  const switchTo = async (a: TestAccount | null) => {
    await setTestAccountId(a?.id ?? null);
    setCurrent(a?.id ?? null);
    await clearProgress();
    await setUiState({
      onboarded: a?.setUp ?? false,
      mode: a?.mode ?? 'owner',
      activeGarageId: null,
      activeWorkshopId: null,
      homeVehicleId: null,
      recents: [],
      mechanicRecents: [],
    });
    queryClient.clear();
    if (router.canDismiss()) router.dismissAll();
    router.replace(a?.setUp ? (a.mode === 'mechanic' ? '/mechanic/dashboard' : '/home') : '/onboarding/welcome');
  };

  return (
    <Screen header={<TopBar backLabel="MY PROFILE" right="TEST ACCOUNTS" />}>
      <ScreenTitle title="Test accounts" lede="Use the app as someone else, to try each situation. Development builds only." />
      <QueryBoundary query={query} isEmpty={(list) => list.length === 0} empty={{ glyph: 'members', title: 'No test accounts yet', body: 'On the computer, in admin/, run: npm run test-accounts' }}>
        {(list) => (
          <View style={styles.list}>
            {list.map((a, i) => (
              <ListRow
                key={a.id}
                title={a.name}
                subtitle={a.summary}
                left={<Avatar name={a.name} size={40} />}
                right={a.id === current ? <T variant="meta" color={Colors.accent}>CURRENT</T> : undefined}
                bordered={i < list.length - 1}
                onPress={() => void switchTo(a)}
              />
            ))}
          </View>
        )}
      </QueryBoundary>
      {current ? (
        <Button variant="secondary" style={styles.back} onPress={() => void switchTo(null)}>
          Back to the default account
        </Button>
      ) : null}
      <Footnote style={styles.foot}>RESET THEM ANY TIME ON THE COMPUTER: NPM RUN TEST-ACCOUNTS (IN ADMIN)</Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: Spacing.md,
  },
  back: {
    marginTop: Spacing.lg,
  },
  foot: {
    marginTop: Spacing.lg,
  },
});
