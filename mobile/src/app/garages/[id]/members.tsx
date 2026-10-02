import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useGarage, useGarageMembers } from '@/data/hooks';
import { MemberRow, ROLE_EXPLAINED } from '@/features/garage/MemberRow';
import { Colors, Spacing } from '@/theme/tokens';

/** Members: two roles only, View only and Contribute. The owner keeps deletion. */
export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const garage = useGarage(id).data;
  const account = useAccount().data;
  const membersQuery = useGarageMembers(id);

  return (
    <Screen
      padded={false}
      header={<TopBar title="Members" right={garage?.name} />}
      headerRule
      footer={
        <Button variant="secondary" glyph="user-add" onPress={() => router.push(`/garages/${id}/invite`)}>
          Invite someone
        </Button>
      }>
      <QueryBoundary query={membersQuery} empty={{ glyph: 'members', title: 'Just you so far.', body: 'Invite the people who drive or look after these vehicles.' }}>
        {(members) => (
          <>
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isYou={m.name === account?.name} />
            ))}
            <View style={styles.roles}>
              <T variant="section">What the two roles mean</T>
              {ROLE_EXPLAINED.map((r) => (
                <View key={r.role} style={styles.role}>
                  <T variant="bodyStrong" style={styles.roleName}>
                    {r.role}
                  </T>
                  <T variant="body" style={styles.flex}>
                    {r.body}
                  </T>
                </View>
              ))}
              <T variant="meta" color={Colors.textFaint}>
                Members join as Contribute. View-only access is coming.
              </T>
            </View>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  roles: {
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  role: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  roleName: {
    width: 84,
  },
  flex: {
    flex: 1,
  },
});
