import { useMemo } from "react";
import {
  ROLES,
  MODULE_KEYS,
  DEFAULT_MODULE_ACCESS,
  type ModuleKey,
} from "@/lib/permissions";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  DataTable,
  AlertBanner,
  type Column,
} from "@/components/ui";
import type { OpaRole } from "@/types/database";

type RoleRow = {
  id: string;
  role: OpaRole;
  viewCount: number;
  createCount: number;
  editCount: number;
  summary: string;
  purchase: boolean;
  accounts: boolean;
};

function accessSummary(role: OpaRole): RoleRow {
  const map = DEFAULT_MODULE_ACCESS[role];
  let viewCount = 0;
  let createCount = 0;
  let editCount = 0;
  const viewMods: string[] = [];
  for (const key of MODULE_KEYS) {
    const a = map[key as ModuleKey];
    if (a?.view) {
      viewCount++;
      viewMods.push(key);
    }
    if (a?.create) createCount++;
    if (a?.edit) editCount++;
  }
  return {
    id: role,
    role,
    viewCount,
    createCount,
    editCount,
    summary: viewMods.slice(0, 6).join(", ") + (viewMods.length > 6 ? "…" : ""),
    purchase: Boolean(map.purchase?.view),
    accounts: Boolean(map.accounts?.view),
  };
}

export default function RolesPage() {
  const { demoMode, profile } = useAuth();

  const rows = useMemo(() => ROLES.map(accessSummary), []);

  const matrixRows = useMemo(() => {
    return MODULE_KEYS.map((mod) => {
      const cells: Record<string, string> = { id: mod, module: mod };
      for (const role of ROLES) {
        const a = DEFAULT_MODULE_ACCESS[role][mod];
        const flags = [
          a.view ? "V" : "·",
          a.create ? "C" : "·",
          a.edit ? "E" : "·",
        ].join("");
        cells[role] = flags;
      }
      return cells;
    });
  }, []);

  const roleColumns: Column<RoleRow>[] = [
    {
      key: "role",
      header: "Role",
      render: (r) => r.role.replace(/_/g, " "),
    },
    { key: "viewCount", header: "View modules", render: (r) => String(r.viewCount) },
    { key: "createCount", header: "Create", render: (r) => String(r.createCount) },
    { key: "editCount", header: "Edit", render: (r) => String(r.editCount) },
    { key: "summary", header: "Module access (sample)", render: (r) => r.summary || "—" },
    {
      key: "purchase",
      header: "Purchase",
      render: (r) => (r.purchase ? "Yes" : "No"),
    },
    {
      key: "accounts",
      header: "Accounts",
      render: (r) => (r.accounts ? "Yes" : "No"),
    },
  ];

  const matrixColumns: Column<Record<string, string>>[] = [
    {
      key: "module",
      header: "Module",
      render: (r) => String(r.module),
    },
    ...ROLES.map(
      (role): Column<Record<string, string>> => ({
        key: role,
        header: role.replace(/_/g, " ").split(" ").map((w) => w[0]).join(""),
        render: (r) => String(r[role] ?? "···"),
      }),
    ),
  ];

  return (
    <>
      <PageHeader
        title="Roles & access"
        subtitle="Read-only role matrix from default permissions (view / create / edit)."
        meta={
          <>
            {demoMode ? <span className="live-chip">Demo Mode</span> : null}
            {profile?.role ? (
              <span className="live-chip">You · {profile.role.replace(/_/g, " ")}</span>
            ) : null}
          </>
        }
      />

      <AlertBanner tone="info" title="Security Guard scope">
        Security Guard can only access the Security module (view/create/edit). Purchase and
        Accounts remain hidden — they cannot see PO, GRN, costing or ledger screens.
      </AlertBanner>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Roles summary</h3>
        </div>
        <DataTable columns={roleColumns} rows={rows} rowKey={(r) => r.id} />
      </section>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Module access matrix</h3>
          <span className="muted">V = view · C = create · E = edit</span>
        </div>
        <div className="table-scroll">
          <DataTable
            columns={matrixColumns}
            rows={matrixRows}
            rowKey={(r) => String(r.id)}
          />
        </div>
      </section>
    </>
  );
}
