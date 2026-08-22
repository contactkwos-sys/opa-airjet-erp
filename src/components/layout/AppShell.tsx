import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { ModuleKey } from "@/lib/permissions";
import { isDeveloperOverride, isPinAdmin } from "@/lib/adminTiers";
import { AppFooter } from "@/components/layout/AppFooter";
import { TopBar } from "@/components/layout/TopBar";

export type NavItem = { to: string; label: string; module: ModuleKey };
export type NavGroup = { id: string; label: string; items: NavItem[] };

const NAV_STORAGE_KEY = "opa_nav_collapsed_v2";

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    items: [{ to: "/", label: "Dashboard", module: "dashboard" }],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/looms", label: "Looms", module: "looms" },
      { to: "/factory-floor", label: "Factory Floor", module: "production" },
      { to: "/production", label: "Production Entry", module: "production" },
      { to: "/daily-report", label: "Daily Production", module: "dashboard" },
      { to: "/planning", label: "Planning", module: "production" },
      { to: "/targets", label: "Targets", module: "production" },
      { to: "/stoppages", label: "Stoppages", module: "production" },
      { to: "/quality", label: "Quality", module: "quality" },
    ],
  },
  {
    id: "stores",
    label: "Stores",
    items: [
      { to: "/yarn", label: "Yarn Store", module: "yarn" },
      { to: "/beams", label: "Beam Store", module: "inventory" },
      { to: "/greige", label: "Greige Store", module: "inventory" },
      { to: "/inventory", label: "Finished Fabric", module: "inventory" },
      { to: "/spares", label: "Spares", module: "inventory" },
    ],
  },
  {
    id: "purchase",
    label: "Purchase",
    items: [
      { to: "/requisitions", label: "Purchase", module: "purchase" },
      { to: "/suppliers", label: "Supplier", module: "purchase" },
      { to: "/grn", label: "GRN", module: "purchase" },
      { to: "/purchase-orders", label: "Purchase Pending", module: "purchase" },
    ],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    items: [
      { to: "/maintenance/requests", label: "Breakdown", module: "maintenance" },
      { to: "/maintenance/work-orders", label: "Maintenance", module: "maintenance" },
      { to: "/maintenance/pm", label: "Preventive Maintenance", module: "maintenance" },
      { to: "/spares", label: "Spare Requests", module: "inventory" },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      { to: "/security", label: "Security Gate", module: "security" },
      { to: "/security/visitors", label: "Visitors", module: "security" },
      { to: "/security/gate-pass", label: "Gate Pass", module: "security" },
      { to: "/alerts", label: "Security Alerts", module: "dashboard" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      { to: "/reports", label: "Production Reports", module: "reports" },
      { to: "/reports?type=efficiency", label: "Efficiency", module: "reports" },
      { to: "/reports?type=downtime", label: "Downtime", module: "reports" },
      { to: "/reports?type=quality", label: "Quality", module: "reports" },
      { to: "/reports?type=stock", label: "Stock", module: "reports" },
      { to: "/reports?type=maintenance", label: "Maintenance", module: "reports" },
      { to: "/daily-report", label: "Management Reports", module: "dashboard" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { to: "/employees", label: "Users", module: "hr" },
      { to: "/admin/employee-overview", label: "Roles", module: "settings" },
      { to: "/admin/security-access", label: "Permissions", module: "settings" },
      { to: "/settings", label: "System Settings", module: "settings" },
    ],
  },
];

const SUPER_ADMIN_GROUP: NavGroup = {
  id: "superadmin",
  label: "Super Admin",
  items: [
    { to: "/admin/security-access", label: "Security", module: "settings" },
    { to: "/audit", label: "Audit Log", module: "audit" },
    { to: "/admin/security-access?tab=pin", label: "PIN Management", module: "settings" },
  ],
};

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    /* ignore */
  }
  return {};
}

export function AppShell() {
  const { signOut, can, role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const persistCollapsed = useCallback((next: Record<string, boolean>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const visibleGroups = useMemo(() => {
    const groups = NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => can(item.module, "view")),
    })).filter((group) => group.items.length > 0);

    if (isPinAdmin(role)) {
      const adminGroup = groups.find((g) => g.id === "admin");
      if (adminGroup) {
        const hasOverview = adminGroup.items.some(
          (i) => i.to === "/admin/employee-overview",
        );
        if (!hasOverview) {
          adminGroup.items.push({
            to: "/admin/employee-overview",
            label: "Employee Links",
            module: "settings" as ModuleKey,
          });
        }
      }
    }

    if (isDeveloperOverride(role)) {
      const superItems = SUPER_ADMIN_GROUP.items.filter((item) =>
        can(item.module, "view"),
      );
      if (superItems.length > 0) {
        groups.push({ ...SUPER_ADMIN_GROUP, items: superItems });
      }
    }

    return groups;
  }, [can, role]);

  useEffect(() => {
    const activeGroup = visibleGroups.find((g) =>
      g.items.some((item) => {
        const path = window.location.pathname;
        return item.to === "/" ? path === "/" : path.startsWith(item.to.split("?")[0]);
      }),
    );
    if (activeGroup && collapsed[activeGroup.id]) {
      persistCollapsed({ ...collapsed, [activeGroup.id]: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`app-shell${open ? " nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            OPA
          </div>
          <h1>OPA Air Jet ERP</h1>
          <p>Plant: OPA Group of India</p>
        </div>

        <nav className="nav nav-groups" aria-label="Primary">
          {visibleGroups.map((group) => {
            const isCollapsed = collapsed[group.id] ?? group.id !== "dashboard";
            return (
              <div key={group.id} className="nav-group">
                <button
                  type="button"
                  className="nav-group-label"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    persistCollapsed({ ...collapsed, [group.id]: !isCollapsed })
                  }
                >
                  <span>{group.label}</span>
                  <span className="nav-chevron" aria-hidden>
                    {isCollapsed ? "›" : "‹"}
                  </span>
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
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="main-column">
        <TopBar onMenuToggle={() => setOpen((v) => !v)} menuOpen={open} />
        <main className="main">
          <div className="main-content">
            <Outlet />
          </div>
          <AppFooter />
        </main>
      </div>
    </div>
  );
}
