import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ModuleKey } from "@/lib/permissions";

export type NavItem = { to: string; label: string; module: ModuleKey };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "executive",
    label: "Executive",
    items: [
      { to: "/", label: "Dashboard", module: "dashboard" },
      { to: "/daily-report", label: "Daily Report", module: "dashboard" },
      { to: "/factory-floor", label: "Factory Floor", module: "production" },
      { to: "/alerts", label: "Alerts", module: "dashboard" },
    ],
  },
  {
    id: "production",
    label: "Production",
    items: [
      { to: "/looms", label: "Looms", module: "looms" },
      { to: "/production", label: "Production Entry", module: "production" },
      { to: "/planning", label: "Planning", module: "production" },
      { to: "/targets", label: "Targets", module: "production" },
      { to: "/stoppages", label: "Stoppages", module: "production" },
      { to: "/quality", label: "Quality", module: "quality" },
    ],
  },
  {
    id: "materials",
    label: "Materials",
    items: [
      { to: "/yarn", label: "Yarn", module: "yarn" },
      { to: "/beams", label: "Beams", module: "inventory" },
      { to: "/greige", label: "Greige", module: "inventory" },
      { to: "/inventory", label: "Inventory", module: "inventory" },
      { to: "/spares", label: "Spares", module: "inventory" },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    items: [
      { to: "/requisitions", label: "Requisitions", module: "purchase" },
      { to: "/purchase-orders", label: "PO", module: "purchase" },
      { to: "/grn", label: "GRN", module: "purchase" },
      { to: "/suppliers", label: "Suppliers", module: "purchase" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { to: "/customers", label: "Customers", module: "sales" },
      { to: "/orders", label: "Orders", module: "sales" },
      { to: "/dispatch", label: "Dispatch", module: "sales" },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    items: [
      { to: "/maintenance/requests", label: "Requests", module: "maintenance" },
      { to: "/maintenance/work-orders", label: "Work Orders", module: "maintenance" },
      { to: "/maintenance/pm", label: "PM", module: "maintenance" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { to: "/employees", label: "Employees", module: "hr" },
      { to: "/attendance", label: "Attendance", module: "hr" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/accounts", label: "Accounts", module: "accounts" },
      { to: "/costing", label: "Costing", module: "costing" },
      { to: "/receivables", label: "Receivables", module: "accounts" },
      { to: "/payables", label: "Payables", module: "accounts" },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { to: "/security", label: "Security Home", module: "security" },
      { to: "/security/visitors", label: "Visitors", module: "security" },
      { to: "/security/ceo-visits", label: "CEO Visits", module: "security" },
      { to: "/security/gate-pass", label: "Gate Pass", module: "security" },
      { to: "/security/inside", label: "Inside Now", module: "security" },
      { to: "/security/vehicles", label: "Vehicles", module: "security" },
      { to: "/security/material-gate", label: "Material Gate", module: "security" },
      { to: "/security/incidents", label: "Incidents", module: "security" },
      { to: "/security/reports", label: "Security Reports", module: "security" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/reports", label: "Reports", module: "reports" },
      { to: "/notifications", label: "Notifications", module: "notifications" },
      { to: "/approvals", label: "Approvals", module: "approvals" },
      { to: "/documents", label: "Documents", module: "documents" },
      { to: "/search", label: "Search", module: "search" },
      { to: "/settings", label: "Settings", module: "settings" },
      { to: "/audit", label: "Audit", module: "audit" },
    ],
  },
];

export function AppShell() {
  const { profile, demoMode, signOut, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.module, "view")),
    })).filter((group) => group.items.length > 0);
  }, [can]);

  return (
    <div className={`app-shell${open ? " nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            OPA
          </div>
          <h1>OPA Group of India</h1>
          <p>Air Jet Loom ERP</p>
        </div>

        {demoMode ? (
          <div className="demo-banner" role="status">
            Demo Mode · SUPER_ADMIN preview
          </div>
        ) : null}

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide menu" : "Show menu"}
        </button>

        <nav className="nav nav-groups" aria-label="Primary">
          {visibleGroups.map((group) => {
            const isCollapsed = collapsed[group.id];
            return (
              <div key={group.id} className="nav-group">
                <button
                  type="button"
                  className="nav-group-label"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))
                  }
                >
                  <span>{group.label}</span>
                  <span aria-hidden>{isCollapsed ? "+" : "−"}</span>
                </button>
                {!isCollapsed ? (
                  <div className="nav-group-items">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                          isActive ? "nav-link active" : "nav-link"
                        }
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <strong>{profile?.full_name ?? "Guest"}</strong>
            <span>{profile?.role?.replace(/_/g, " ") ?? "—"}</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost sidebar-signout"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
          >
            Sign out
          </button>
          <p className="foot-note">
            Plant control room · Shed A &amp; B
            <br />
            72 air-jet looms
          </p>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
