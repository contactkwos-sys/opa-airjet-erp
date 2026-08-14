import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export type NavItem = { to: string; label: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "executive",
    label: "Executive",
    items: [
      { to: "/", label: "Dashboard" },
      { to: "/daily-report", label: "Daily Report" },
      { to: "/factory-floor", label: "Factory Floor" },
      { to: "/alerts", label: "Alerts" },
    ],
  },
  {
    id: "production",
    label: "Production",
    items: [
      { to: "/looms", label: "Looms" },
      { to: "/production", label: "Production Entry" },
      { to: "/planning", label: "Planning" },
      { to: "/targets", label: "Targets" },
      { to: "/stoppages", label: "Stoppages" },
      { to: "/quality", label: "Quality" },
    ],
  },
  {
    id: "materials",
    label: "Materials",
    items: [
      { to: "/yarn", label: "Yarn" },
      { to: "/beams", label: "Beams" },
      { to: "/greige", label: "Greige" },
      { to: "/inventory", label: "Inventory" },
      { to: "/spares", label: "Spares" },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    items: [
      { to: "/requisitions", label: "Requisitions" },
      { to: "/purchase-orders", label: "PO" },
      { to: "/grn", label: "GRN" },
      { to: "/suppliers", label: "Suppliers" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { to: "/customers", label: "Customers" },
      { to: "/orders", label: "Orders" },
      { to: "/dispatch", label: "Dispatch" },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    items: [
      { to: "/maintenance/requests", label: "Requests" },
      { to: "/maintenance/work-orders", label: "Work Orders" },
      { to: "/maintenance/pm", label: "PM" },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { to: "/employees", label: "Employees" },
      { to: "/attendance", label: "Attendance" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { to: "/costing", label: "Costing" },
      { to: "/receivables", label: "Receivables" },
      { to: "/payables", label: "Payables" },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { to: "/security/visitors", label: "Visitors" },
      { to: "/security/ceo-visits", label: "CEO Visits" },
      { to: "/security/gate-pass", label: "Gate Pass" },
      { to: "/security/vehicles", label: "Vehicles" },
      { to: "/security/material-gate", label: "Material Gate" },
      { to: "/security/incidents", label: "Incidents" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/reports", label: "Reports" },
      { to: "/notifications", label: "Notifications" },
      { to: "/approvals", label: "Approvals" },
      { to: "/documents", label: "Documents" },
      { to: "/search", label: "Search" },
      { to: "/settings", label: "Settings" },
      { to: "/audit", label: "Audit" },
    ],
  },
];

export function AppShell() {
  const { profile, demoMode, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
          {NAV_GROUPS.map((group) => {
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
            Fleet capacity 72 air jet looms
          </p>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
