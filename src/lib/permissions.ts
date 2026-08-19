import type { OpaRole } from "@/types/database";

export const ROLES: OpaRole[] = [
  "SUPER_ADMIN",
  "CEO",
  "DIRECTOR",
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
  "SECURITY_HEAD",
  "SECURITY_GUARD",
  "QUALITY_MANAGER",
];

export const MODULE_KEYS = [
  "dashboard",
  "production",
  "looms",
  "inventory",
  "yarn",
  "purchase",
  "sales",
  "maintenance",
  "quality",
  "hr",
  "security",
  "accounts",
  "settings",
  "approvals",
  "audit",
  "documents",
  "costing",
  "reports",
  "notifications",
  "search",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export";

export type ModuleAccess = Record<PermissionAction, boolean>;

const full: ModuleAccess = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  approve: true,
  export: true,
};

const viewOnly: ModuleAccess = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
};

const none: ModuleAccess = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  export: false,
};

function allModules(access: ModuleAccess): Record<ModuleKey, ModuleAccess> {
  return Object.fromEntries(
    MODULE_KEYS.map((k) => [k, { ...access }]),
  ) as Record<ModuleKey, ModuleAccess>;
}

/** Default module access map by role (mirrors seed permission intent). */
export const DEFAULT_MODULE_ACCESS: Record<
  OpaRole,
  Record<ModuleKey, ModuleAccess>
> = {
  SUPER_ADMIN: allModules(full),
  CEO: allModules({ ...full, delete: false }),
  DIRECTOR: allModules({ ...full, delete: false }),
  FACTORY_MANAGER: allModules({ ...full, delete: false }),
  PRODUCTION_MANAGER: {
    ...allModules(viewOnly),
    dashboard: full,
    production: full,
    looms: full,
    quality: { ...viewOnly, create: true, edit: true },
  },
  PRODUCTION_SUPERVISOR: {
    ...allModules(none),
    dashboard: viewOnly,
    production: { ...viewOnly, create: true, edit: true },
    looms: { ...viewOnly, edit: true },
  },
  LOOM_OPERATOR: {
    ...allModules(none),
    production: { ...viewOnly, create: true },
    looms: viewOnly,
  },
  MAINTENANCE_HEAD: {
    ...allModules(viewOnly),
    maintenance: full,
    looms: { ...viewOnly, edit: true },
  },
  TECHNICIAN: {
    ...allModules(none),
    maintenance: { ...viewOnly, create: true, edit: true },
    looms: viewOnly,
  },
  STORE_MANAGER: {
    ...allModules(none),
    inventory: full,
    yarn: full,
    dashboard: viewOnly,
  },
  PURCHASE_MANAGER: {
    ...allModules(none),
    purchase: full,
    inventory: viewOnly,
    approvals: { ...viewOnly, approve: true },
  },
  SALES_MANAGER: {
    ...allModules(none),
    sales: full,
    dashboard: viewOnly,
  },
  ACCOUNTS: {
    ...allModules(none),
    accounts: full,
    costing: full,
    purchase: viewOnly,
    sales: viewOnly,
  },
  HR: {
    ...allModules(none),
    hr: full,
  },
  SECURITY_HEAD: {
    ...allModules(none),
    security: full,
  },
  SECURITY_GUARD: {
    ...allModules(none),
    security: { ...viewOnly, create: true, edit: true },
    settings: viewOnly,
  },
  QUALITY_MANAGER: {
    ...allModules(none),
    quality: full,
    production: viewOnly,
    dashboard: viewOnly,
  },
};

export function hasPermission(
  role: OpaRole | null | undefined,
  module: ModuleKey,
  action: PermissionAction,
  overrides?: Partial<Record<ModuleKey, Partial<ModuleAccess>>>,
): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  const base = DEFAULT_MODULE_ACCESS[role]?.[module];
  const merged = { ...base, ...overrides?.[module] };
  return Boolean(merged?.[action]);
}
