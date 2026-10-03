import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Footnote, KeyValueRow, Rule, ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, usePlans, useUiState } from '@/data/hooks';
import { openLegal } from '@/features/auth/legal';
import { daysLeft } from '@/features/billing/plan';
import { buy, loadProducts, manageSubscription, periodLabel, restore, storeAvailable, type StoreProduct } from '@/features/billing/store';
import { formatDateLong } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import type { PlanLimits, PlanOption, PlanState } from '@/types/domain';

const limit = (n: number | null | undefined, one: string, many: string) => (n == null ? `Unlimited ${many}` : `${n} ${n === 1 ? one : many}`);

function limitLines(l: PlanLimits, workshop: boolean) {
  if (workshop) return [limit(l.jobsPerMonth, 'job a month', 'jobs a month'), limit(l.staff, 'staff member', 'staff')];
  return [limit(l.garages, 'garage', 'garages'), limit(l.vehicles, 'vehicle', 'vehicles'), l.seats === 1 ? 'Just you' : limit(l.seats, 'person per garage', 'people per garage')];
}

const day = (iso: string | null | undefined) => (iso ? formatDateLong(iso.slice(0, 10)) : '');
const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

function headlineFor(ps: PlanState | null) {
  if (!ps) return { title: 'Your plan', lede: 'Plans are not set up on this server yet.' };
  if (ps.state === 'trial') {
    return {
      title: `${ps.name} trial, ${daysLeft(ps.trialEndsAt)} days left`,
      lede: `Everything is unlocked until ${day(ps.trialEndsAt)}. After that your records stay readable; adding past the Free limits needs a plan.`,
    };
  }
  if (ps.state === 'grace') {
    return { title: `${ps.name}, payment due`, lede: `${storeName} could not take the last payment. Update your payment details there to keep ${ps.name}.` };
  }
  if (ps.state === 'free') return { title: `You are on ${ps.name}`, lede: 'Your records stay readable. Adding past these limits needs a plan.' };
  if (ps.store && ps.willRenew === false) return { title: `You are on ${ps.name}`, lede: `Auto-renew is off. ${ps.name} ends on ${day(ps.currentPeriodEnd)}.` };
  if (ps.store && ps.currentPeriodEnd) return { title: `You are on ${ps.name}`, lede: `Renews on ${day(ps.currentPeriodEnd)}. Thanks for paying for Carma.` };
  return { title: `You are on ${ps.name}`, lede: 'Thanks for paying for Carma.' };
}

/**
 * Plan & billing: the plan in force, and the plans with the store's own
 * prices. Buying goes through App Store / Google Play billing
 * (@/features/billing/store); the server then reads the purchase from the
 * store, so what is shown always comes from the account.
 */
export default function BillingScreen() {
  const account = useAccount().data;
  const mode = useUiState('mode');
  const workshop = mode === 'mechanic' && Boolean(account?.workshopPlanState);
  const ps = (workshop ? account?.workshopPlanState : account?.planState) ?? null;
  const plansQuery = usePlans(workshop ? 'WORKSHOP' : 'OWNER');
  const canBuy = storeAvailable();

  const productIds = (plansQuery.data ?? []).flatMap((p) => p.storeProductIds ?? []);
  const productsQuery = useQuery({
    queryKey: ['store-products', account?.id, productIds.join(',')],
    queryFn: () => loadProducts(account!.id, productIds),
    enabled: canBuy && Boolean(account) && productIds.length > 0,
    staleTime: 10 * 60_000,
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const productsFor = (p: PlanOption): StoreProduct[] => {
    const ids = p.storeProductIds ?? [];
    return (productsQuery.data ?? []).filter((sp) => ids.includes(sp.identifier) || ids.includes(sp.identifier.split(':')[0]));
  };

  const onBuy = async (product: StoreProduct) => {
    if (!account) return;
    setBusy(product.identifier);
    setNote(null);
    const r = await buy(account.id, product, ps?.storeProductId ?? null);
    setBusy(null);
    if (!r.ok && !r.cancelled) setNote(r.message ?? 'The purchase did not go through.');
  };

  const onRestore = async () => {
    if (!account) return;
    setBusy('restore');
    setNote(null);
    const r = await restore(account.id);
    setBusy(null);
    setNote(r.ok ? 'Purchases restored.' : (r.message ?? 'Nothing to restore.'));
  };

  const { title, lede } = headlineFor(ps);
  const paidInStore = Boolean(ps?.store) && ps?.state !== 'free';

  return (
    <Screen header={<TopBar backLabel="SETTINGS" right="PLAN & BILLING" />}>
      <ScreenTitle title={title} lede={lede} />
      {ps
        ? limitLines(ps.limits, workshop).map((line, i, all) => <KeyValueRow key={line} label={i === 0 ? 'Allows' : ''} value={line} last={i === all.length - 1} />)
        : null}
      {paidInStore && account ? (
        <Button variant="secondary" fullWidth style={styles.manage} onPress={() => void manageSubscription(account.id)}>
          Manage subscription
        </Button>
      ) : null}
      <Rule />
      <T variant="section" style={styles.section}>
        Plans
      </T>
      <QueryBoundary query={plansQuery} isEmpty={(p) => p.length === 0}>
        {(plans) => (
          <View style={styles.list}>
            {plans.map((p) => {
              const current = ps?.code === p.code;
              const products = productsFor(p);
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
                  {products.length > 0 && !(current && ps?.state === 'active') ? (
                    <View style={styles.buy}>
                      {products.map((sp) => (
                        <Button
                          key={sp.identifier}
                          variant={current ? 'primary' : 'soft'}
                          size="sm"
                          loading={busy === sp.identifier}
                          disabled={busy !== null}
                          onPress={() => void onBuy(sp)}>
                          {`${sp.priceString} ${periodLabel(sp.subscriptionPeriod)}`.trim()}
                        </Button>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </QueryBoundary>

      {note ? (
        <T variant="small" color={Colors.body} style={styles.note}>
          {note}
        </T>
      ) : null}

      {canBuy ? (
        <>
          <Pressable onPress={() => void onRestore()} disabled={busy !== null} style={styles.restore}>
            <T variant="bodyStrong" color={Colors.accent}>
              {busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
            </T>
          </Pressable>
          <Footnote style={styles.foot}>
            {`PAYMENT IS CHARGED TO YOUR ${Platform.OS === 'ios' ? 'APPLE ID' : 'GOOGLE PLAY'} ACCOUNT. SUBSCRIPTIONS RENEW AUTOMATICALLY UNLESS CANCELLED AT LEAST 24 HOURS BEFORE THE PERIOD ENDS. MANAGE OR CANCEL IN YOUR ${storeName.toUpperCase()} SETTINGS.`}
          </Footnote>
          <View style={styles.legal}>
            <Pressable onPress={() => openLegal('terms')}>
              <T variant="small" color={Colors.accent}>
                Terms of use
              </T>
            </Pressable>
            <Pressable onPress={() => openLegal('privacy')}>
              <T variant="small" color={Colors.accent}>
                Privacy policy
              </T>
            </Pressable>
          </View>
        </>
      ) : null}
      <Footnote style={styles.foot}>NOTHING YOU RECORDED IS EVER LOCKED AWAY. RECORDS STAY READABLE ON EVERY PLAN.</Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  manage: {
    marginTop: Spacing.md,
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
  buy: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  note: {
    marginTop: Spacing.md,
  },
  restore: {
    marginTop: Spacing.lg,
    alignSelf: 'flex-start',
  },
  legal: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  foot: {
    marginTop: Spacing.lg,
  },
});
