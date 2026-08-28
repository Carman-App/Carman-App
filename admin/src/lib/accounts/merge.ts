import { prisma } from "@/lib/prisma";

// ACCT-08 merge. Shared between the preview screen and the confirm/undo
// server actions so the shape of "what moves" can't drift between them.
export type MovedRefs = {
  garageIds: string[];
  garageMemberIds: string[];
  vehicleMembershipIds: string[];
  workshopIds: string[];
  workshopMemberIds: string[];
  subscriptionIds: string[];
  notificationIds: string[];
  skipped?: {
    garageMemberIds: string[];
    vehicleMembershipIds: string[];
    workshopMemberIds: string[];
  };
};

export type MergePreview = {
  primary: { id: string; name: string; email: string } | null;
  secondary: { id: string; name: string; email: string } | null;
  error?: string;
  garages: { id: string; name: string }[];
  garageMemberships: { id: string; garageName: string; role: string }[];
  vehicleMemberships: { id: string; plate: string }[];
  workshops: { id: string; name: string }[];
  workshopMemberships: { id: string; workshopName: string; role: string }[];
  subscriptions: { id: string; status: string }[];
  notifications: { id: string; title: string }[];
};

/** Read-only — computes what a merge WOULD move, without writing anything. */
export async function previewMerge(primaryId: string, secondaryId: string): Promise<MergePreview> {
  const empty: MergePreview = {
    primary: null,
    secondary: null,
    garages: [],
    garageMemberships: [],
    vehicleMemberships: [],
    workshops: [],
    workshopMemberships: [],
    subscriptions: [],
    notifications: [],
  };

  if (!primaryId || !secondaryId) return { ...empty, error: "Provide both account ids." };
  if (primaryId === secondaryId) return { ...empty, error: "Pick two different accounts." };

  const [primaryAccount, secondaryAccount] = await Promise.all([
    prisma.account.findUnique({ where: { id: primaryId }, include: { user: true } }),
    prisma.account.findUnique({ where: { id: secondaryId }, include: { user: true } }),
  ]);

  if (!primaryAccount) return { ...empty, error: `No account found for primary id "${primaryId}".` };
  if (!secondaryAccount) return { ...empty, error: `No account found for secondary id "${secondaryId}".` };
  if (secondaryAccount.mergedIntoAccountId) {
    return { ...empty, error: "That secondary account has already been merged into another account." };
  }
  if (primaryAccount.mergedIntoAccountId) {
    return { ...empty, error: "That primary account has itself already been merged — pick its surviving account instead." };
  }

  const [garages, garageMemberships, vehicleMemberships, workshops, workshopMemberships, subscriptions, notifications] =
    await Promise.all([
      prisma.garage.findMany({ where: { ownerId: secondaryId }, select: { id: true, name: true } }),
      prisma.garageMember.findMany({
        where: { accountId: secondaryId },
        select: { id: true, role: true, garage: { select: { name: true } } },
      }),
      prisma.vehicleMembership.findMany({
        where: { accountId: secondaryId },
        select: { id: true, vehicle: { select: { plate: true } } },
      }),
      prisma.workshop.findMany({ where: { ownerId: secondaryId }, select: { id: true, name: true } }),
      prisma.workshopMember.findMany({
        where: { accountId: secondaryId },
        select: { id: true, role: true, workshop: { select: { name: true } } },
      }),
      prisma.subscription.findMany({ where: { accountId: secondaryId }, select: { id: true, status: true } }),
      prisma.notification.findMany({ where: { accountId: secondaryId }, select: { id: true, title: true } }),
    ]);

  return {
    primary: { id: primaryAccount.id, name: primaryAccount.user.name, email: primaryAccount.user.email },
    secondary: { id: secondaryAccount.id, name: secondaryAccount.user.name, email: secondaryAccount.user.email },
    garages,
    garageMemberships: garageMemberships.map((g) => ({ id: g.id, garageName: g.garage.name, role: g.role })),
    vehicleMemberships: vehicleMemberships.map((v) => ({ id: v.id, plate: v.vehicle.plate })),
    workshops,
    workshopMemberships: workshopMemberships.map((w) => ({ id: w.id, workshopName: w.workshop.name, role: w.role })),
    subscriptions,
    notifications: notifications.map((n) => ({ id: n.id, title: n.title })),
  };
}
