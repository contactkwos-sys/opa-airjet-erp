import type { AppRole } from "../types/security";

export type Permission =
  | "security.dashboard"
  | "security.visitor.create"
  | "security.visitor.view"
  | "security.visitor.checkin"
  | "security.visitor.checkout"
  | "security.gatepass"
  | "security.incident"
  | "security.vehicle"
  | "security.material"
  | "security.reports"
  | "security.notifications"
  | "ceo.requests.view"
  | "ceo.requests.decide"
  | "admin.full";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  SUPER_ADMIN: ["admin.full"],
  CEO: [
    "ceo.requests.view",
    "ceo.requests.decide",
    "security.visitor.view",
    "security.notifications",
  ],
  DIRECTOR: [
    "ceo.requests.view",
    "security.visitor.view",
    "security.reports",
    "security.notifications",
  ],
  SECURITY_HEAD: [
    "security.dashboard",
    "security.visitor.create",
    "security.visitor.view",
    "security.visitor.checkin",
    "security.visitor.checkout",
    "security.gatepass",
    "security.incident",
    "security.vehicle",
    "security.material",
    "security.reports",
    "security.notifications",
  ],
  SECURITY_GUARD: [
    "security.dashboard",
    "security.visitor.create",
    "security.visitor.view",
    "security.visitor.checkin",
    "security.visitor.checkout",
    "security.gatepass",
    "security.vehicle",
    "security.notifications",
  ],
  FACTORY_MANAGER: [
    "security.reports",
    "security.visitor.view",
    "security.dashboard",
  ],
};

export function hasPermission(role: AppRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes("admin.full") || perms.includes(permission);
}

export function canAccessSecurity(role: AppRole): boolean {
  return (
    hasPermission(role, "admin.full") ||
    hasPermission(role, "security.dashboard") ||
    hasPermission(role, "ceo.requests.view") ||
    hasPermission(role, "security.reports")
  );
}

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CEO: "CEO",
  DIRECTOR: "Director",
  SECURITY_HEAD: "Security Head",
  SECURITY_GUARD: "Security Guard",
  FACTORY_MANAGER: "Factory Manager",
};
