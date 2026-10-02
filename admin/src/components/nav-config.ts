import { AdminRole } from "@/generated/prisma/enums";

// Mirrors the role sets in src/lib/auth/rbac.ts (kept duplicated, not
// imported, because rbac.ts is `server-only` and this file is consumed by
// the client-side sidebar-nav.tsx). If you change a role gate on a page,
// change it here too — this only controls what's worth *showing*; the
// page-level requireRole() call is what actually protects it.
const ALL_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT, AdminRole.FINANCE, AdminRole.READ];
const ACCOUNTS_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
const BILLING_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.FINANCE];
const ADMIN_MANAGEMENT_ROLES: AdminRole[] = [AdminRole.OWNER];
const AUDIT_LOG_ROLES: AdminRole[] = [AdminRole.OWNER];
const SUPPORT_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
const TRUST_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
const MESSAGING_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
const GROWTH_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
const DATA_QUALITY_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
const CONFIG_ROLES: AdminRole[] = [AdminRole.OWNER, AdminRole.SUPPORT];
const SYSTEM_ROLES: AdminRole[] = [AdminRole.OWNER];
const PRIVACY_ROLES: AdminRole[] = [AdminRole.OWNER];

export type NavItem = { href: string; label: string; roles: AdminRole[] };
export type NavSection = { label: string; items: NavItem[] };

// Phase Two ("Phase TWO · RUN" in AGENTS.md) routes registered up front by
// the lead agent so the parallel sub-agents building Garages+Vehicles,
// Workshops+Work, Money, Support+Trust, and Messaging never need to touch
// this shared file (avoids concurrent-edit conflicts). Each surface's
// sub-navigation (tabs, secondary links) lives inside its own landing page,
// not spelled out here. Phase Three (Growth, Records/data quality, Config,
// System, Privacy) routes are registered the same way, up front, below.
export const NAV_SECTIONS: NavSection[] = [
  { label: "", items: [{ href: "/", label: "Pulse", roles: ALL_ROLES }] },
  {
    label: "Accounts",
    items: [{ href: "/accounts", label: "Owners & Mechanics", roles: ACCOUNTS_ROLES }],
  },
  {
    label: "Garages & Vehicles",
    items: [
      { href: "/garages", label: "Garages", roles: ACCOUNTS_ROLES },
      { href: "/vehicles", label: "Vehicles", roles: ACCOUNTS_ROLES },
      { href: "/records", label: "Records", roles: ACCOUNTS_ROLES },
      { href: "/documents", label: "Documents", roles: ACCOUNTS_ROLES },
    ],
  },
  {
    label: "Workshops & Work",
    items: [
      { href: "/workshops", label: "Workshops", roles: ACCOUNTS_ROLES },
      { href: "/jobs", label: "Jobs", roles: ACCOUNTS_ROLES },
      { href: "/work", label: "Work overview", roles: ACCOUNTS_ROLES },
    ],
  },
  {
    label: "",
    items: [{ href: "/billing", label: "Money", roles: BILLING_ROLES }],
  },
  {
    label: "Support",
    items: [{ href: "/support", label: "Ticket queue", roles: SUPPORT_ROLES }],
  },
  {
    label: "Trust & Safety",
    items: [{ href: "/trust", label: "Reports & disputes", roles: TRUST_ROLES }],
  },
  {
    label: "Messaging",
    items: [{ href: "/messaging", label: "Campaigns & templates", roles: MESSAGING_ROLES }],
  },
  {
    label: "Growth",
    items: [{ href: "/growth", label: "Growth", roles: GROWTH_ROLES }],
  },
  {
    label: "Data quality",
    items: [{ href: "/data-quality", label: "Records & data quality", roles: DATA_QUALITY_ROLES }],
  },
  {
    label: "Configuration",
    items: [{ href: "/config", label: "Config", roles: CONFIG_ROLES }],
  },
  {
    label: "System",
    items: [{ href: "/system", label: "System", roles: SYSTEM_ROLES }],
  },
  {
    label: "Privacy",
    items: [{ href: "/privacy", label: "Data rights", roles: PRIVACY_ROLES }],
  },
  {
    label: "Admin",
    items: [
      { href: "/approvals", label: "Approvals", roles: [AdminRole.OWNER, AdminRole.FINANCE] },
      { href: "/audit", label: "Audit log", roles: AUDIT_LOG_ROLES },
      { href: "/admin-users", label: "Admins & roles", roles: ADMIN_MANAGEMENT_ROLES },
      { href: "/security", label: "My security", roles: ALL_ROLES },
    ],
  },
];
