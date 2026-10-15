export const USER_ROLES = ["BUYER", "BROKER", "DEALER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles a person may pick for themselves at sign-up. ADMIN is never self-assignable. */
export const SELF_ASSIGNABLE_ROLES = ["BUYER", "BROKER", "DEALER"] as const satisfies readonly UserRole[];
export type SelfAssignableRole = (typeof SELF_ASSIGNABLE_ROLES)[number];

/** Roles that can list vehicles for sale. */
export const SELLER_ROLES = ["BROKER", "DEALER"] as const satisfies readonly UserRole[];

export const USER_STATUSES = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  BUYER: "Buyer",
  BROKER: "Broker",
  DEALER: "Dealer",
  ADMIN: "Administrator",
};
