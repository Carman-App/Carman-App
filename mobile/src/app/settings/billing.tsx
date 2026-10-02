import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Footnote, KeyValueRow, Rule, ScreenTitle } from '@/components/ui/Blocks';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, usePlans } from '@/data/hooks';
import { daysLeft } from '@/features/billing/plan';
import { formatDateLong } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import type { PlanLimits } from '@/types/domain';

const limit = (n: number | null | undefined, one: string, many: string) => (n == null ? `Unlimited ${many}` : `${n} ${n === 1 ? one : many}`);

function limitLines(l: PlanLimits) {
  return [limit(l.garages, 'garage', 'garages'), limit(l.vehicles, 'vehicle', 'vehicles'), l.seats === 1 ? 'Just you' : limit(l.seats, 'person per garage', 'people per garage')];
}

/**
 * Plan & billing: the plan in force, what it allows, and the other plans.
 * Informational only: no prices and no purchase prompt. The stores require
 * subscriptions to be sold through App Store / Google Play billing, which is
 * not built yet (see STORE.md); until it is, nothing is sold in the app.
 */
export default function BillingScreen() {
  const accountQuery = useAccount();
  const plansQuery = usePlans('OWNER');
  const ps = accountQuery.data?.planState ?? null;

  const headline = !ps
    ? 'Your plan'
    : ps.state === 'trial'
      ? `${ps.name} trial, ${daysLeft(ps.trialEndsAt)} days left`
      : ps.state === 'grace'
        ? `${ps.name}, payment due`
        : `You are on ${ps.name}`;
  const lede = !ps
    ? 'Plans are not set up on this server yet.'
    : ps.state === 'trial'
      ? `Everything is unlocked until ${formatDateLong(ps.trialEndsAt!.slice(0, 10))}. After that your records stay readable; adding past the Free limits needs a plan.`
      : ps.state === 'free'
        ? 'Your records stay readable. Adding past these limits needs a plan.'
        : 'Thanks for paying for Carma.';

  return (
    <Screen header={<TopBar backLabel="SETTINGS" right="PLAN & BILLING" />}>
      <ScreenTitle title={headline} lede={lede} />
      {ps ? (
        <>
          {limitLines(ps.limits).map((line, i, all) => (
            <KeyValueRow key={line} label={i === 0 ? 'Allows' : ''} value={line} last={i === all.length - 1} />
          ))}
        </>
      ) : null}
      <Rule />
      <T variant="section" style={styles.section}>
        Plans
      </T>
      <QueryBoundary query={plansQuery} isEmpty={(p) => p.length === 0}>
        {(plans) => (
          <View style={styles.list}>
            {plans.map((p) => {
              const current = ps?.code === p.code && ps.state !== 'free' ? true : ps?.state === 'free' && p.code === ps.code;
              return (
                <View key={p.code} style={[styles.plan, current && styles.planCurrent]}>
                  <View style={styles.planHead}>
                    <T variant="bodyStrong">{p.name}</T>
                    <T variant="meta" color={current ? Colors.accent : Colors.body}>
                      {current ? (ps?.state === 'trial' ? 'TRIAL' : 'CURRENT') : ''}
                    </T>
                  </View>
                  <T variant="small" color={Colors.body}>
                    {p.features.join(' · ')}
                  </T>
                </View>
              );
            })}
          </View>
        )}
      </QueryBoundary>
      <Footnote style={styles.foot}>NOTHING YOU RECORDED IS EVER LOCKED AWAY. RECORDS STAY READABLE ON EVERY PLAN.</Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  list: {
    gap: 10,
  },
  plan: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  planCurrent: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  planHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foot: {
    marginTop: Spacing.lg,
  },
});
