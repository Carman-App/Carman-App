import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES, CONFIG_PUBLISH_ROLES } from "@/lib/auth/rbac";
import { ConfigObjectType } from "@/generated/prisma/enums";
import { getDraft, diffAgainstLive, listVersionHistory } from "@/lib/config/versioning";
import { Section } from "@/components/detail-view";
import { ConfigTabs } from "../config-tabs";
import { VersionPanel } from "../version-panel";
import { SubscriptionRulesForm, type SubscriptionRulesFormValues } from "./subscription-rules-form";

export const dynamic = "force-dynamic";

const GLOBAL_KEY = "global";

export default async function SubscriptionRulesPage() {
  const session = await requireRole(CONFIG_ROLES);

  const [rules, draft] = await Promise.all([
    prisma.subscriptionRules.findUnique({ where: { key: GLOBAL_KEY } }),
    getDraft(ConfigObjectType.SUBSCRIPTION_RULES, GLOBAL_KEY),
  ]);

  const draftPayload = draft?.payload as Partial<SubscriptionRulesFormValues> | undefined;

  const initial: SubscriptionRulesFormValues = {
    trialDays: draftPayload?.trialDays ?? rules?.trialDays ?? 14,
    graceDays: draftPayload?.graceDays ?? rules?.graceDays ?? 7,
    dunningScheduleDays: draftPayload?.dunningScheduleDays ?? rules?.dunningScheduleDays ?? [1, 3, 7],
    defaultSeatLimit:
      draftPayload?.defaultSeatLimit !== undefined ? draftPayload.defaultSeatLimit : (rules?.defaultSeatLimit ?? null),
  };

  const diff = draft
    ? await diffAgainstLive(ConfigObjectType.SUBSCRIPTION_RULES, GLOBAL_KEY, draft.payload as Record<string, unknown>)
    : null;
  const history = await listVersionHistory(ConfigObjectType.SUBSCRIPTION_RULES, GLOBAL_KEY);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configuration</h1>
        <p className="text-sm text-neutral-500">
          CFG-08 Subscription rules — single global row (trial length, grace period, dunning schedule, seat limit).
        </p>
      </div>

      <ConfigTabs active="subscription-rules" />

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        These rules apply to <strong>new subscriptions only</strong> going forward — publishing a change here never
        retroactively edits an existing subscription&apos;s trial/grace/dunning terms (see{" "}
        <code>Subscription.lockedPriceCents</code>/<code>lockedCurrency</code> for the analogous rule on pricing).
        There is no per-plan override yet; this is the single global row referenced everywhere.
      </div>

      <Section title="Edit / stage draft">
        <SubscriptionRulesForm initial={initial} />
      </Section>

      <Section title="Draft, diff & publish">
        <VersionPanel
          objectKey={GLOBAL_KEY}
          canPublish={CONFIG_PUBLISH_ROLES.includes(session.role)}
          draft={draft ? { id: draft.id, note: draft.note } : null}
          diff={diff}
          history={history}
          revalidate="/config/subscription-rules"
        />
      </Section>
    </div>
  );
}
