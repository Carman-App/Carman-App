import "server-only";
import { prismaRead as prisma } from "@/lib/prisma";
import { InvitationStatus, SignupSource } from "@/generated/prisma/enums";

// GROW-04 — sent/accepted counts from GarageInvitation (status/createdAt/
// acceptedAt), share of accounts whose userId's email matches an accepted
// invitation email, median/average acceptance time.

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type InvitePerformance = {
  sent: number;
  accepted: number;
  declined: number;
  expired: number;
  pending: number;
  acceptedPercent: number | null;
  medianAcceptanceHours: number | null;
  averageAcceptanceHours: number | null;
  /**
   * Accounts don't store which invitation created them (no FK from Account
   * back to GarageInvitation) — this is a best-effort match on
   * lower-cased email string against every ACCEPTED invitation's email, not
   * a guaranteed causal link (an account could independently share an email
   * with an invite it never actually accepted through, e.g. re-signup).
   */
  accountsMatchingAcceptedInviteEmail: number;
  totalAccounts: number;
  accountsMatchingAcceptedInviteEmailPercent: number | null;
  /** Cross-check via the real, purpose-built Account.signupSource = INVITE field (GROW-02) — more reliable going forward than the email match above, since it's stamped at signup rather than inferred after the fact. */
  accountsWithSignupSourceInvite: number;
};

export async function getInvitePerformance(): Promise<InvitePerformance> {
  const [invitations, accounts, accountsWithSignupSourceInvite] = await Promise.all([
    prisma.garageInvitation.findMany({ select: { email: true, status: true, createdAt: true, acceptedAt: true } }),
    prisma.account.findMany({ where: { deletedAt: null }, select: { user: { select: { email: true } } } }),
    prisma.account.count({ where: { deletedAt: null, signupSource: SignupSource.INVITE } }),
  ]);

  const sent = invitations.length;
  const accepted = invitations.filter((i) => i.status === InvitationStatus.ACCEPTED).length;
  const declined = invitations.filter((i) => i.status === InvitationStatus.DECLINED).length;
  const expired = invitations.filter((i) => i.status === InvitationStatus.EXPIRED).length;
  const pending = invitations.filter((i) => i.status === InvitationStatus.PENDING).length;

  const acceptanceHours = invitations
    .filter((i) => i.status === InvitationStatus.ACCEPTED && i.acceptedAt)
    .map((i) => (i.acceptedAt!.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60));

  const acceptedEmails = new Set(
    invitations.filter((i) => i.status === InvitationStatus.ACCEPTED).map((i) => i.email.toLowerCase()),
  );
  const accountsMatchingAcceptedInviteEmail = accounts.filter((a) =>
    acceptedEmails.has(a.user.email.toLowerCase()),
  ).length;

  return {
    sent,
    accepted,
    declined,
    expired,
    pending,
    acceptedPercent: sent === 0 ? null : (accepted / sent) * 100,
    medianAcceptanceHours: median(acceptanceHours),
    averageAcceptanceHours: acceptanceHours.length
      ? acceptanceHours.reduce((s, v) => s + v, 0) / acceptanceHours.length
      : null,
    accountsMatchingAcceptedInviteEmail,
    totalAccounts: accounts.length,
    accountsMatchingAcceptedInviteEmailPercent:
      accounts.length === 0 ? null : (accountsMatchingAcceptedInviteEmail / accounts.length) * 100,
    accountsWithSignupSourceInvite,
  };
}
