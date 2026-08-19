import type { OpaRole } from "@/types/database";

/** Human labels for PIN login role picker (no secrets). */
export const ROLE_PIN_LABELS: Record<OpaRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CEO: "CEO",
  DIRECTOR: "Director",
  FACTORY_MANAGER: "Plant Manager",
  PRODUCTION_MANAGER: "Production Manager",
  PRODUCTION_SUPERVISOR: "Production Supervisor",
  LOOM_OPERATOR: "Loom Operator",
  MAINTENANCE_HEAD: "Maintenance Head",
  TECHNICIAN: "Technician",
  STORE_MANAGER: "Store Manager",
  PURCHASE_MANAGER: "Purchase Manager",
  SALES_MANAGER: "Sales Manager",
  ACCOUNTS: "Accounts",
  HR: "HR",
  SECURITY_HEAD: "Security Head",
  SECURITY_GUARD: "Security",
  QUALITY_MANAGER: "Quality Manager",
};

/**
 * Roles shown on the public employee login screen.
 * Super Admin is intentionally excluded — use the hidden /super-login route.
 */
export const EMPLOYEE_PIN_LOGIN_ROLES: OpaRole[] = [
  "FACTORY_MANAGER",
  "PRODUCTION_MANAGER",
  "SECURITY_GUARD",
];

/** All roles that can have a PIN (admin management + audit). */
export const PIN_MANAGED_ROLES: OpaRole[] = [
  "FACTORY_MANAGER",
  "PRODUCTION_MANAGER",
  "PRODUCTION_SUPERVISOR",
  "LOOM_OPERATOR",
  "MAINTENANCE_HEAD",
  "TECHNICIAN",
  "STORE_MANAGER",
  "PURCHASE_MANAGER",
  "SALES_MANAGER",
  "ACCOUNTS",
  "HR",
  "QUALITY_MANAGER",
  "SECURITY_HEAD",
  "SECURITY_GUARD",
  "CEO",
  "DIRECTOR",
  "SUPER_ADMIN",
];

/** @deprecated Use EMPLOYEE_PIN_LOGIN_ROLES for public login. */
export const PIN_LOGIN_ROLES = EMPLOYEE_PIN_LOGIN_ROLES;

/** Failed PIN attempts before lockout. */
export const PIN_MAX_FAILED_ATTEMPTS = 5;
