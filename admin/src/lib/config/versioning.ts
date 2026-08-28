import "server-only";
import { prisma } from "@/lib/prisma";
import {
  ConfigObjectType,
  ConfigVersionStatus,
  Region,
  SubscriptionStatus,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { writeAdminAuditLog } from "@/lib/audit";
import { requireRole, CONFIG_ROLES, CONFIG_PUBLISH_ROLES } from "@/lib/auth/rbac";

/**
 * CFG-06/07 — the one generic draft/publish/diff/history/revert mechanism
 * shared by every config object type (Country, PlanPrice, ConfigList,
 * FeatureFlag, SubscriptionRules) instead of five bespoke implementations.
 * See prisma/schema.prisma's ConfigVersion model comment for the full
 * lifecycle description this file implements.
 *
 * Role enforcement lives here, not just in each story's page/action, so a
 * story can never accidentally let SUPPORT publish or revert: stageDraft and
 * the read helpers require CONFIG_ROLES; publishVersion and revertToVersion
 * independently call requireRole(CONFIG_PUBLISH_ROLES) themselves (OWNER
 * only), mirroring how MESSAGING_SEND_ROLES gates COMM-01's go-live step.
 */

export type ConfigPayload = Record<string, unknown>;

export type DiffEntry = { field: string; before: unknown; after: unknown };

const REGION_VALUES = Object.values(Region) as string[];

function isDraftPayload(v: unknown): v is ConfigPayload {
  return typeof v === "object" && v !== null;
}

/** Human label for an objectKey, used in audit entityType so the audit log reads e.g. "ConfigVersion:COUNTRY". */
function versionEntityType(objectType: ConfigObjectType): string {
  return `ConfigVersion:${objectType}`;
}

// ---------------------------------------------------------------------------
// Reading the live table, for diffing when no PUBLISHED version exists yet.
// ---------------------------------------------------------------------------

async function readLivePayload(objectType: ConfigObjectType, objectKey: string): Promise<ConfigPayload | null> {
  switch (objectType) {
    case ConfigObjectType.COUNTRY: {
      const c = await prisma.country.findUnique({ where: { code: objectKey } });
      if (!c) return null;
      return {
        code: c.code,
        name: c.name,
        currencyCode: c.currencyCode,
        currencySymbol: c.currencySymbol,
        currencySymbolPlacement: c.currencySymbolPlacement,
        distanceUnit: c.distanceUnit,
        volumeUnit: c.volumeUnit,
        dateFormat: c.dateFormat,
        flagEmoji: c.flagEmoji,
        isLive: c.isLive,
      };
    }
    case ConfigObjectType.PLAN_PRICE: {
      const [planId, currency] = objectKey.split(":");
      const p = await prisma.planPrice.findUnique({ where: { planId_currency: { planId, currency } } });
      if (!p) return null;
      return { planId: p.planId, currency: p.currency, priceCents: p.priceCents };
    }
    case ConfigObjectType.LIST: {
      const list = await prisma.configList.findUnique({
        where: { key: objectKey },
        include: { items: { orderBy: { sortOrder: "asc" } } },
      });
      if (!list) return null;
      return {
        label: list.label,
        items: list.items.map((i) => ({
          code: i.code,
          label: i.label,
          sortOrder: i.sortOrder,
          metadata: i.metadata,
          isActive: i.isActive,
        })),
      };
    }
    case ConfigObjectType.FEATURE_FLAG: {
      const f = await prisma.featureFlag.findUnique({ where: { key: objectKey } });
      if (!f) return null;
      return { key: f.key, description: f.description, isEnabled: f.isEnabled, audience: f.audience };
    }
    case ConfigObjectType.SUBSCRIPTION_RULES: {
      const r = await prisma.subscriptionRules.findUnique({ where: { key: objectKey } });
      if (!r) return null;
      return {
        trialDays: r.trialDays,
        graceDays: r.graceDays,
        dunningScheduleDays: r.dunningScheduleDays,
        defaultSeatLimit: r.defaultSeatLimit,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Applying a payload to the live table, shared by publish and revert.
// ---------------------------------------------------------------------------

async function applyPayloadToLive(
  objectType: ConfigObjectType,
  objectKey: string,
  payload: ConfigPayload,
  adminId: string,
): Promise<void> {
  switch (objectType) {
    case ConfigObjectType.COUNTRY: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per ConfigObjectType; ConfigPayload is intentionally Record<string, unknown> at this generic boundary
      const p = payload as Record<string, any>;
      await prisma.country.upsert({
        where: { code: objectKey },
        create: {
          code: objectKey,
          name: p.name,
          currencyCode: p.currencyCode,
          currencySymbol: p.currencySymbol,
          currencySymbolPlacement: p.currencySymbolPlacement,
          distanceUnit: p.distanceUnit,
          volumeUnit: p.volumeUnit,
          dateFormat: p.dateFormat,
          flagEmoji: p.flagEmoji ?? null,
          isLive: !!p.isLive,
          updatedByAdminId: adminId,
        },
        update: {
          name: p.name,
          currencyCode: p.currencyCode,
          currencySymbol: p.currencySymbol,
          currencySymbolPlacement: p.currencySymbolPlacement,
          distanceUnit: p.distanceUnit,
          volumeUnit: p.volumeUnit,
          dateFormat: p.dateFormat,
          flagEmoji: p.flagEmoji ?? null,
          isLive: !!p.isLive,
          updatedByAdminId: adminId,
        },
      });
      return;
    }
    case ConfigObjectType.PLAN_PRICE: {
      const [planId, currency] = objectKey.split(":");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per ConfigObjectType; ConfigPayload is intentionally Record<string, unknown> at this generic boundary
      const p = payload as Record<string, any>;
      await prisma.planPrice.upsert({
        where: { planId_currency: { planId, currency } },
        create: { planId, currency, priceCents: p.priceCents, updatedByAdminId: adminId },
        update: { priceCents: p.priceCents, updatedByAdminId: adminId },
      });
      return;
    }
    case ConfigObjectType.LIST: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per ConfigObjectType; ConfigPayload is intentionally Record<string, unknown> at this generic boundary
      const p = payload as Record<string, any>;
      const list = await prisma.configList.upsert({
        where: { key: objectKey },
        create: { key: objectKey, label: p.label },
        update: { label: p.label },
      });
      const items = (p.items ?? []) as Array<{
        code: string;
        label: string;
        sortOrder?: number;
        metadata?: unknown;
        isActive?: boolean;
      }>;
      for (const item of items) {
        await prisma.configListItem.upsert({
          where: { listId_code: { listId: list.id, code: item.code } },
          create: {
            listId: list.id,
            code: item.code,
            label: item.label,
            sortOrder: item.sortOrder ?? 0,
            metadata: (item.metadata as Prisma.InputJsonValue) ?? undefined,
            isActive: item.isActive ?? true,
            updatedByAdminId: adminId,
          },
          update: {
            label: item.label,
            sortOrder: item.sortOrder ?? 0,
            metadata: (item.metadata as Prisma.InputJsonValue) ?? undefined,
            isActive: item.isActive ?? true,
            updatedByAdminId: adminId,
          },
        });
      }
      return;
    }
    case ConfigObjectType.FEATURE_FLAG: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per ConfigObjectType; ConfigPayload is intentionally Record<string, unknown> at this generic boundary
      const p = payload as Record<string, any>;
      await prisma.featureFlag.upsert({
        where: { key: objectKey },
        create: {
          key: objectKey,
          description: p.description ?? null,
          isEnabled: !!p.isEnabled,
          audience: (p.audience as Prisma.InputJsonValue) ?? undefined,
          createdByAdminId: adminId,
          updatedByAdminId: adminId,
        },
        update: {
          description: p.description ?? null,
          isEnabled: !!p.isEnabled,
          audience: (p.audience as Prisma.InputJsonValue) ?? undefined,
          updatedByAdminId: adminId,
        },
      });
      return;
    }
    case ConfigObjectType.SUBSCRIPTION_RULES: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per ConfigObjectType; ConfigPayload is intentionally Record<string, unknown> at this generic boundary
      const p = payload as Record<string, any>;
      await prisma.subscriptionRules.upsert({
        where: { key: objectKey },
        create: {
          key: objectKey,
          trialDays: p.trialDays,
          graceDays: p.graceDays,
          dunningScheduleDays: p.dunningScheduleDays ?? [],
          defaultSeatLimit: p.defaultSeatLimit ?? null,
          updatedByAdminId: adminId,
        },
        update: {
          trialDays: p.trialDays,
          graceDays: p.graceDays,
          dunningScheduleDays: p.dunningScheduleDays ?? [],
          defaultSeatLimit: p.defaultSeatLimit ?? null,
          updatedByAdminId: adminId,
        },
      });
      return;
    }
  }
}

/**
 * "A reasonable count of accounts plausibly affected" per the brief — best
 * effort, documented per case, not a guarantee:
 *  - COUNTRY: Region (Account's field) is a fixed 7-value enum (KE/UG/TZ/
 *    NG/ZA/US/GB) while Country.code is an admin-creatable ISO alpha-2 code
 *    — there is no FK between them. This counts accounts only when the
 *    country's code happens to match a Region value; otherwise 0.
 *  - PLAN_PRICE: active/trialing/past-due subscriptions on that plan,
 *    regardless of currency (Subscription doesn't track currency except the
 *    optional post-hoc lockedCurrency).
 *  - LIST: no direct account count — null, shown as "not applicable" in the UI.
 *  - FEATURE_FLAG: accountIds.length if targeted by id; accounts in the
 *    targeted Regions if targeted by country; every non-deleted account if
 *    audience is null (everyone) and enabled; null if targeted by cohort
 *    (no cohort definition exists anywhere in this codebase to evaluate).
 *  - SUBSCRIPTION_RULES: null — applies to new subscriptions only, never an
 *    existing account.
 */
async function computeAccountsTouched(
  objectType: ConfigObjectType,
  objectKey: string,
  payload: ConfigPayload,
): Promise<number | null> {
  switch (objectType) {
    case ConfigObjectType.COUNTRY: {
      if (REGION_VALUES.includes(objectKey)) {
        return prisma.account.count({ where: { region: objectKey as Region, deletedAt: null } });
      }
      return 0;
    }
    case ConfigObjectType.PLAN_PRICE: {
      const [planId] = objectKey.split(":");
      return prisma.subscription.count({
        where: {
          planId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] },
        },
      });
    }
    case ConfigObjectType.LIST:
      return null;
    case ConfigObjectType.FEATURE_FLAG: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per ConfigObjectType; ConfigPayload is intentionally Record<string, unknown> at this generic boundary
      const p = payload as Record<string, any>;
      if (!p.isEnabled) return 0;
      const audience = p.audience as { accountIds?: string[]; countries?: string[]; cohort?: string } | null | undefined;
      if (!audience) return prisma.account.count({ where: { deletedAt: null } });
      if (audience.accountIds?.length) return audience.accountIds.length;
      if (audience.countries?.length) {
        const regions = audience.countries.filter((c) => REGION_VALUES.includes(c)) as Region[];
        if (regions.length === 0) return 0;
        return prisma.account.count({ where: { region: { in: regions }, deletedAt: null } });
      }
      if (audience.cohort) return null;
      return 0;
    }
    case ConfigObjectType.SUBSCRIPTION_RULES:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create or replace the single working DRAFT for (objectType, objectKey).
 * Unlike PUBLISHED rows, a DRAFT is mutated in place while it's being
 * prepared — there is one active draft per key at a time, not an
 * append-only trail of abandoned edits. Callable by CONFIG_ROLES
 * (SUPPORT can prepare a draft; only OWNER can publish it).
 */
export async function stageDraft(input: {
  objectType: ConfigObjectType;
  objectKey: string;
  payload: ConfigPayload;
  note?: string;
}): Promise<{ id: string }> {
  const admin = await requireRole(CONFIG_ROLES);

  const existing = await prisma.configVersion.findFirst({
    where: { objectType: input.objectType, objectKey: input.objectKey, status: ConfigVersionStatus.DRAFT },
  });

  const version = existing
    ? await prisma.configVersion.update({
        where: { id: existing.id },
        data: {
          payload: input.payload as Prisma.InputJsonValue,
          note: input.note ?? existing.note,
          createdByAdminId: admin.adminId,
        },
      })
    : await prisma.configVersion.create({
        data: {
          objectType: input.objectType,
          objectKey: input.objectKey,
          payload: input.payload as Prisma.InputJsonValue,
          note: input.note ?? null,
          createdByAdminId: admin.adminId,
        },
      });

  await writeAdminAuditLog(admin, {
    action: "config.stage_draft",
    entityType: versionEntityType(input.objectType),
    entityId: version.id,
    reason: input.note ?? null,
    afterData: { objectKey: input.objectKey, payload: input.payload },
  });

  return { id: version.id };
}

/** The current working draft for a key, if any — used to prefill an edit form. */
export async function getDraft(objectType: ConfigObjectType, objectKey: string) {
  await requireRole(CONFIG_ROLES);
  return prisma.configVersion.findFirst({
    where: { objectType, objectKey, status: ConfigVersionStatus.DRAFT },
  });
}

/** Discards the working draft for a key without publishing it. */
export async function discardDraft(versionId: string): Promise<void> {
  const admin = await requireRole(CONFIG_ROLES);
  const version = await prisma.configVersion.findUnique({ where: { id: versionId } });
  if (!version) return;
  if (version.status !== ConfigVersionStatus.DRAFT) throw new Error("Only a draft can be discarded.");
  await prisma.configVersion.delete({ where: { id: versionId } });
  await writeAdminAuditLog(admin, {
    action: "config.discard_draft",
    entityType: versionEntityType(version.objectType),
    entityId: versionId,
    metadata: { objectKey: version.objectKey },
  });
}

/**
 * Diffs a draft payload (or any payload) against the most recent PUBLISHED
 * ConfigVersion for the same key, falling back to the live table's current
 * values if nothing has ever been published for this key.
 */
export async function diffAgainstLive(
  objectType: ConfigObjectType,
  objectKey: string,
  draftPayload: ConfigPayload,
): Promise<{ baseline: ConfigPayload | null; baselineSource: "published_version" | "live_table" | "none"; diffs: DiffEntry[] }> {
  await requireRole(CONFIG_ROLES);

  const lastPublished = await prisma.configVersion.findFirst({
    where: { objectType, objectKey, status: ConfigVersionStatus.PUBLISHED },
    orderBy: { publishedAt: "desc" },
  });

  let baseline: ConfigPayload | null;
  let baselineSource: "published_version" | "live_table" | "none";
  if (lastPublished) {
    baseline = isDraftPayload(lastPublished.payload) ? (lastPublished.payload as ConfigPayload) : null;
    baselineSource = "published_version";
  } else {
    baseline = await readLivePayload(objectType, objectKey);
    baselineSource = baseline ? "live_table" : "none";
  }

  const diffs: DiffEntry[] = [];
  const keys = new Set([...Object.keys(baseline ?? {}), ...Object.keys(draftPayload)]);
  for (const key of keys) {
    const before = baseline ? (baseline as Record<string, unknown>)[key] : undefined;
    const after = (draftPayload as Record<string, unknown>)[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diffs.push({ field: key, before, after });
    }
  }

  return { baseline, baselineSource, diffs };
}

/** Every DRAFT/PUBLISHED ConfigVersion row for a key, newest first — the CFG-07 history/timeline. */
export async function listVersionHistory(objectType: ConfigObjectType, objectKey: string) {
  await requireRole(CONFIG_ROLES);
  return prisma.configVersion.findMany({
    where: { objectType, objectKey },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Publishes a DRAFT: applies its payload to the live table, computes
 * accountsTouchedCount, and flips the same row to PUBLISHED. OWNER-only
 * (CONFIG_PUBLISH_ROLES) and requires a non-empty reason — reuses the
 * ConfigVersion.note field rather than adding a second reason field.
 */
export async function publishVersion(input: { versionId: string; note?: string }): Promise<{ accountsTouchedCount: number | null }> {
  const admin = await requireRole(CONFIG_PUBLISH_ROLES);

  const version = await prisma.configVersion.findUnique({ where: { id: input.versionId } });
  if (!version) throw new Error("Draft not found.");
  if (version.status !== ConfigVersionStatus.DRAFT) {
    throw new Error(`This version is already ${version.status.toLowerCase()}.`);
  }
  const note = (input.note ?? version.note ?? "").trim();
  if (!note) throw new Error("A reason is required to publish.");

  const payload = version.payload as ConfigPayload;
  const accountsTouchedCount = await computeAccountsTouched(version.objectType, version.objectKey, payload);

  await applyPayloadToLive(version.objectType, version.objectKey, payload, admin.adminId);

  const published = await prisma.configVersion.update({
    where: { id: version.id },
    data: {
      status: ConfigVersionStatus.PUBLISHED,
      note,
      publishedByAdminId: admin.adminId,
      publishedAt: new Date(),
      accountsTouchedCount,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "config.publish",
    entityType: versionEntityType(version.objectType),
    entityId: version.id,
    reason: note,
    afterData: { objectKey: version.objectKey, payload, accountsTouchedCount },
  });

  return { accountsTouchedCount: published.accountsTouchedCount ?? null };
}

/**
 * CFG-07 one-action revert: re-applies an older PUBLISHED version's payload
 * to the live table and records that as a brand-new PUBLISHED ConfigVersion
 * row — the target row itself is never mutated, matching AuditLog's
 * append-only convention. OWNER-only, requires a reason.
 */
export async function revertToVersion(input: { versionId: string; note: string }): Promise<{ id: string }> {
  const admin = await requireRole(CONFIG_PUBLISH_ROLES);
  const note = input.note.trim();
  if (!note) throw new Error("A reason is required to revert.");

  const target = await prisma.configVersion.findUnique({ where: { id: input.versionId } });
  if (!target) throw new Error("Version not found.");
  if (target.status !== ConfigVersionStatus.PUBLISHED) {
    throw new Error("Can only revert to a previously published version.");
  }

  const payload = target.payload as ConfigPayload;
  const accountsTouchedCount = await computeAccountsTouched(target.objectType, target.objectKey, payload);
  await applyPayloadToLive(target.objectType, target.objectKey, payload, admin.adminId);

  const reverted = await prisma.configVersion.create({
    data: {
      objectType: target.objectType,
      objectKey: target.objectKey,
      payload: payload as Prisma.InputJsonValue,
      status: ConfigVersionStatus.PUBLISHED,
      note,
      createdByAdminId: admin.adminId,
      publishedByAdminId: admin.adminId,
      publishedAt: new Date(),
      accountsTouchedCount,
    },
  });

  await writeAdminAuditLog(admin, {
    action: "config.revert",
    entityType: versionEntityType(target.objectType),
    entityId: reverted.id,
    reason: note,
    metadata: { revertedFromVersionId: target.id },
    afterData: { objectKey: target.objectKey, payload, accountsTouchedCount },
  });

  return { id: reverted.id };
}
