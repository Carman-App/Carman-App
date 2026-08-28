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

export type NavItem = { href: string; label: string; roles: AdminRole[] };
export type NavSection = { label: string; items: NavItem[] };

// Phase Two/Three surfaces (Money, Workshops verification, Work, Support
// queue, Trust, Growth, Config, Messaging, System, Privacy) are out of
// scope for this pass; the pre-existing read-only list/detail pages below
// are left in place but labelled as a preview, not rebuilt to the fuller
// Phase Two spec.
export const NAV_SECTIONS: NavSection[] = [
  { label: "", items: [{ href: "/", label: "Pulse", roles: ALL_ROLES }] },
  {
    label: "Accounts",
    items: [{ href: "/accounts", label: "Owners & Mechanics", roles: ACCOUNTS_ROLES }],
  },
  {
    label: "Owner side (read-only preview)",
    items: [
      { href: "/garages", label: "Garages", roles: ACCOUNTS_ROLES },
      { href: "/vehicles", label: "Vehicles", roles: ACCOUNTS_ROLES },
      { href: "/records", label: "Records", roles: ACCOUNTS_ROLES },
      { href: "/documents", label: "Documents", roles: ACCOUNTS_ROLES },
    ],
  },
  {
    label: "Workshop side (read-only preview)",
    items: [
      { href: "/workshops", label: "Workshops", roles: ACCOUNTS_ROLES },
      { href: "/jobs", label: "Jobs", roles: ACCOUNTS_ROLES },
    ],
  },
  {
    label: "",
    items: [{ href: "/billing", label: "Billing & Plans", roles: BILLING_ROLES }],
  },
  {
    label: "Admin",
    items: [
      { href: "/audit", label: "Audit log", roles: AUDIT_LOG_ROLES },
      { href: "/admin-users", label: "Admins & roles", roles: ADMIN_MANAGEMENT_ROLES },
      { href: "/security", label: "My security", roles: ALL_ROLES },
    ],
  },
];
