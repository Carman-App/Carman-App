import "server-only";
import { redirect, forbidden } from "next/navigation";
import { getSession, type CurrentSession } from "./session";
import { AdminRole } from "@/generated/prisma/enums";

// Central role policy for the admin console — see AGENTS.md section 03
// ("Admin roles"). Every check here is meant to be called from a Server
// Component, Server Action, or Route Handler; there is no client-only
// enforcement anywhere (buttons may additionally be hidden client-side for
// UX, but the server check is what actually protects the data).

export { AdminRole };

/** Redirects to /login if not signed in. Does not check role. */
export async function requireAdmin(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Redirects to /login if not signed in, and renders a real 403 (via
 * next/navigation's forbidden(), see next.config.ts authInterrupts) if
 * signed in but the role isn't in `allowed`. Use this at the top of every
 * role-gated page/layout/server action — never rely on hiding a nav link.
 */
export async function requireRole(allowed: AdminRole[]): Promise<CurrentSession> {
  const session = await requireAdmin();
  if (!allowed.includes(session.role)) {
    forbidden();
  }
  return session;
}

// --- Phase One policy, per the AGENTS.md role table -----------------------

/** Accounts (search + detail — read access, and the "support quick-actions") — "SUPPORT and OWNER need full Accounts access." */
export const ACCOUNTS_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];

/**
 * Within Accounts, not every action is equal — the role table's per-role
 * Can/Cannot lists still apply action-by-action:
 *   SUPPORT can "reset, resend, unlock" -> the support quick-actions below.
 *   SUPPORT's Cannot list names "suspend" explicitly, and doesn't include
 *   merge or region/currency correction, both of which carry real
 *   irreversible-adjacent risk (moving data between accounts, changing what
 *   currency history is read against) — so those, plus suspend and restore
 *   (undoing a delete, the mirror-image of suspend), are OWNER-only.
 */
export const ACCOUNT_QUICK_ACTION_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT]; // resend/reset/unlock/manual-verify
export const ACCOUNT_DANGEROUS_ACTION_ROLES: AdminRole[] = [AdminRole.OWNER]; // suspend/restore/merge/region-correction

/** Admin account/role management and the audit log — oversight tooling, OWNER only. */
export const ADMIN_MANAGEMENT_ROLES: AdminRole[] = [AdminRole.OWNER];
export const AUDIT_LOG_ROLES: AdminRole[] = [AdminRole.OWNER];

/** Billing & Plans — FINANCE's actual domain ("subscriptions, payments... for the accountant"); SUPPORT/READ have no reason to be here. */
export const BILLING_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.FINANCE];
/** MON-07 refund/credit is squarely inside FINANCE's "refunds" Can-list — same roles as Billing, distinguished only by the two-person approval above a threshold (see src/lib/approvals.ts). */
export const MONEY_REFUND_ROLES: AdminRole[] = BILLING_ROLES;

// --- Phase Two policy (see AGENTS.md "Phase TWO · RUN") --------------------
// Garages/Vehicles and Workshops/Work read surfaces name individual
// accounts/vehicles/workshops, so they follow ACCOUNTS_ROLES exactly like
// the existing Phase One garages/vehicles/workshops/jobs pages already do.

export const GARAGE_ROLES: AdminRole[] = ACCOUNTS_ROLES;
/** GAR-07 garage ownership handover — irreversible-adjacent, two-person approved, OWNER-only to request or approve. */
export const GARAGE_TRANSFER_ROLES: AdminRole[] = [AdminRole.OWNER];

export const WORK_ROLES: AdminRole[] = ACCOUNTS_ROLES;
/** WORK-02/03 grant/revoke a workshop's verified mark — reputational and platform-facing, OWNER-only. */
export const WORKSHOP_VERIFICATION_ROLES: AdminRole[] = [AdminRole.OWNER];
/** WORK-08 call/message log entries are routine ops notes, same roster as the rest of Accounts/Work. */
export const WORK_CONTACT_LOG_ROLES: AdminRole[] = ACCOUNTS_ROLES;

/** SUP-01..08 ticket queue — SUPPORT's named domain ("reply, escalate"), plus OWNER oversight. */
export const SUPPORT_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
/** SUP-03 "view as user" consent-session scaffolding — logged/no-op today either way, same roster as the rest of Support. */
export const CONSENT_SESSION_ROLES: AdminRole[] = SUPPORT_ROLES;

/** TRUST-01/02 read queues — SUPPORT's "escalate" duty, plus OWNER. */
export const TRUST_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
/** TRUST-03/05/06 — capability restriction, image takedown, and regulator disclosure approval are all suspend-shaped (irreversible-adjacent, reputational, or legal) — OWNER-only, mirroring ACCOUNT_DANGEROUS_ACTION_ROLES. */
export const TRUST_DANGEROUS_ROLES: AdminRole[] = [AdminRole.OWNER];

/** COMM-01..06 — building/editing campaigns, templates, and banners is SUPPORT+OWNER operational work. */
export const MESSAGING_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
/** COMM-01 taking a campaign live (after its required test send) reaches every recipient in a segment — OWNER-only, test/draft/build stays MESSAGING_ROLES. */
export const MESSAGING_SEND_ROLES: AdminRole[] = [AdminRole.OWNER];

// --- Phase Three policy (see AGENTS.md "Phase THREE · STEER") --------------

/** GROW-01..08 — growth analytics names individual accounts (GROW-08's shortlist), so it follows ACCOUNTS_ROLES like Garages/Work do. */
export const GROWTH_ROLES: AdminRole[] = ACCOUNTS_ROLES;

/** DATA-01..06 — records/data-quality surfaces per-account storage and sync-error detail, same roster as Accounts/Records. */
export const DATA_QUALITY_ROLES: AdminRole[] = ACCOUNTS_ROLES;

/** CFG-01..08 — authoring/drafting config is OWNER+SUPPORT operational work, mirroring MESSAGING_ROLES. */
export const CONFIG_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
/** CFG-06 taking a draft live changes what every account's app would eventually read — OWNER-only, mirroring MESSAGING_SEND_ROLES. */
export const CONFIG_PUBLISH_ROLES: AdminRole[] = [AdminRole.OWNER];

/** OPS-01..07 — introspective platform/ops visibility (errors, deploys, backups, costs), not customer data — OWNER-only, grouped with the rest of Admin. */
export const SYSTEM_ROLES: AdminRole[] = [AdminRole.OWNER];

/** PRIV-01..05 — data export, deletion policy, consent, and retention config are compliance-grade and irreversible-adjacent — OWNER-only, mirroring ACCOUNT_DANGEROUS_ACTION_ROLES/TRUST_DANGEROUS_ROLES. PRIV-05's masking/reveal is applied inside Money's existing billing pages and stays gated by BILLING_ROLES there, not this constant. */
export const PRIVACY_ROLES: AdminRole[] = [AdminRole.OWNER];

export function canAccessAccounts(role: AdminRole): boolean {
  return ACCOUNTS_ROLES.includes(role);
}

export function canRunAccountQuickAction(role: AdminRole): boolean {
  return ACCOUNT_QUICK_ACTION_ROLES.includes(role);
}

export function canRunDangerousAccountAction(role: AdminRole): boolean {
  return ACCOUNT_DANGEROUS_ACTION_ROLES.includes(role);
}

/** Pulse's aggregate numbers/alerts are visible to every role (READ's whole purpose). */
export function canViewPulse(): boolean {
  return true;
}

/**
 * PULSE-03's live feed names accounts — READ "cannot reach a named account
 * at all", so READ gets the aggregate numbers and alert strip but not the feed.
 */
export function canViewPulseFeed(role: AdminRole): boolean {
  return role !== AdminRole.READ;
}

/** Only roles that can open Accounts should get a live link to one from anywhere (Pulse feed, Garage/Vehicle owner fields, etc). */
export function canLinkToAccount(role: AdminRole): boolean {
  return canAccessAccounts(role);
}

export function roleLabel(role: AdminRole): string {
  switch (role) {
    case AdminRole.OWNER:
      return "Owner";
    case AdminRole.SUPPORT:
      return "Support";
    case AdminRole.FINANCE:
      return "Finance";
    case AdminRole.READ:
      return "Read-only";
  }
}

export const ROLE_DESCRIPTIONS: Record<AdminRole, { can: string; cannot: string }> = {
  OWNER: {
    can: "Everything, including admin accounts, plans and config publishing.",
    cannot: "Escape the audit log, or approve their own two-person action.",
  },
  SUPPORT: {
    can: "Find accounts, read state, reset, resend, unlock, reply, escalate.",
    cannot: "Refund, suspend, change plans, publish config.",
  },
  FINANCE: {
    can: "Subscriptions, payments, refunds, exports for the accountant.",
    cannot: "Open a user's records, photos or receipts.",
  },
  READ: {
    can: "Aggregate numbers and health, no personal data.",
    cannot: "Reach a named account at all.",
  },
};
