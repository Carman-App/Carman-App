import { useIsFetching } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Dot } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { NetworkError } from '@/data/api/client';
import { useAccount } from '@/data/hooks';
import { queryClient } from '@/data/queryClient';
import { Colors, Spacing } from '@/theme/tokens';

/**
 * Sync. Shows whether this phone can reach Carma. Records are written to the
 * server the moment you save them, so nothing queues on the phone; when the
 * network is down, saving tells you so instead of pretending.
 */
export default function SyncScreen() {
  const accountQuery = useAccount();
  const fetching = useIsFetching();
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const offline = accountQuery.error instanceof NetworkError;
  const failing = accountQuery.isError && !offline;

  const retry = async () => {
    await queryClient.refetchQueries({ type: 'active' });
    setCheckedAt(new Date());
  };

  const time = `${String(checkedAt.getHours()).padStart(2, '0')}:${String(checkedAt.getMinutes()).padStart(2, '0')}`;

  return (
    <Screen
      padded={false}
      header={
        <TopBar
          right={
            <View style={styles.status}>
              <Dot color={offline || failing ? Colors.orange : Colors.positive} />
              <T variant="meta" color={Colors.ink}>
                {offline ? 'Offline · working from this phone' : failing ? 'Carma is not answering' : 'Online'}
              </T>
            </View>
          }
        />
      }
      footer={
        <Button loading={fetching > 0} onPress={retry}>
          {offline || failing ? 'Try to sync now' : 'Check again'}
        </Button>
      }>
      <View style={styles.head}>
        <T variant="display">{offline ? 'You are offline.' : failing ? 'Carma could not be reached.' : 'Everything is synced.'}</T>
        <T variant="lede">
          {offline
            ? 'What you already opened stays readable. New records need the network: saving will tell you if it could not reach Carma, and nothing is lost from the form.'
            : failing
              ? 'The phone is online but the Carma server returned an error. Try again in a moment.'
              : 'Every record you save goes straight to your garage, so other members see it as soon as they open Carma.'}
        </T>
      </View>
      <View style={styles.row}>
        <T variant="bodyStrong" style={styles.flex}>
          Last checked
        </T>
        <T variant="meta">Today at {time}</T>
      </View>
      <View style={styles.row}>
        <T variant="bodyStrong" style={styles.flex}>
          Waiting on this phone
        </T>
        <T variant="meta">Nothing</T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  head: {
    padding: Spacing.lg,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  flex: {
    flex: 1,
  },
});
