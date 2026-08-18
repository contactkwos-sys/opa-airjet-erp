import { Navigate } from "react-router-dom";
import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { MODULE_KEYS, ROLES } from "@/lib/permissions";
import { rolePermissionFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const BOOL = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const columns: Column<Row>[] = [
  { key: "role", header: "Role", render: (r) => String(r.role ?? "—").replace(/_/g, " ") },
  { key: "module", header: "Module", render: (r) => String(r.module ?? "—") },
  {
    key: "can_view",
    header: "View",
    render: (r) => (r.can_view ? "✓" : "—"),
  },
  {
    key: "can_create",
    header: "Create",
    render: (r) => (r.can_create ? "✓" : "—"),
  },
  {
    key: "can_edit",
    header: "Edit",
    render: (r) => (r.can_edit ? "✓" : "—"),
  },
  {
    key: "can_delete",
    header: "Delete",
    render: (r) => (r.can_delete ? "✓" : "—"),
  },
  {
    key: "can_approve",
    header: "Approve",
    render: (r) => (r.can_approve ? "✓" : "—"),
  },
  {
    key: "can_export",
    header: "Export",
    render: (r) => (r.can_export ? "✓" : "—"),
  },
];

const fields = [
  {
    name: "role",
    label: "Role",
    type: "select" as const,
    required: true,
    options: ROLES.map((r) => ({ value: r, label: r.replace(/_/g, " ") })),
  },
  {
    name: "module",
    label: "Module",
    type: "select" as const,
    required: true,
    options: MODULE_KEYS.map((m) => ({ value: m, label: m })),
  },
  { name: "can_view", label: "Can view", type: "select" as const, required: true, options: BOOL },
  {
    name: "can_create",
    label: "Can create",
    type: "select" as const,
    required: true,
    options: BOOL,
  },
  { name: "can_edit", label: "Can edit", type: "select" as const, required: true, options: BOOL },
  {
    name: "can_delete",
    label: "Can delete",
    type: "select" as const,
    required: true,
    options: BOOL,
  },
  {
    name: "can_approve",
    label: "Can approve",
    type: "select" as const,
    required: true,
    options: BOOL,
  },
  {
    name: "can_export",
    label: "Can export",
    type: "select" as const,
    required: true,
    options: BOOL,
  },
];

export default function RolesPage() {
  const { profile, can } = useAuth();
  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canManage =
    isSuperAdmin || (can("settings", "edit") && can("approvals", "approve"));

  if (!can("settings", "view") && !can("approvals", "view") && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <ModulePage
      title="Role Permissions"
      subtitle="Module access matrix by role (SUPER_ADMIN)."
      table="opa_role_permissions"
      moduleKey="settings"
      columns={columns}
      fields={fields}
      orderBy={{ column: "role", ascending: true }}
      schema={rolePermissionFormSchema}
      readOnly={!canManage}
      allowCreate={canManage}
      createDefaults={() => ({
        role: "PRODUCTION_SUPERVISOR",
        module: "production",
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
        can_approve: false,
        can_export: false,
      })}
    />
  );
}
