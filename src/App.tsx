import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  buildLooms,
  fleet,
  loomNavItems,
  operations,
  production,
  securityNavItems,
  type LoomStatus,
  type LoomNavId,
  type SecurityNavId,
} from "./data";
import { useAuth } from "./lib/auth";
import { ROLE_LABELS } from "./lib/roles";
import { canAccessSecurity, hasPermission } from "./lib/roles";
import { listNotifications } from "./services/securityService";
import { LoginPage } from "./modules/security/LoginPage";
import { SecurityDashboard } from "./modules/security/SecurityDashboard";
import { VisitorRequestsPage } from "./modules/security/VisitorRequestsPage";
import { CeoVisitRequestsPage } from "./modules/security/CeoVisitRequestsPage";
import {
  GatePassPage,
  VisitorHistoryPage,
  VisitorsInsidePage,
} from "./modules/security/GateAndHistory";
import {
  MaterialGatePage,
  SecurityIncidentsPage,
  VehicleManagementPage,
} from "./modules/security/VehiclesMaterialIncidents";
import {
  NotificationsPage,
  SecurityReportsPage,
  SecuritySettingsPage,
} from "./modules/security/ReportsNotifications";
import { CeoApprovalPage } from "./modules/ceo/CeoApprovalPage";
import { isSupabaseConfigured } from "./lib/supabase";
import { subscribeStore } from "./lib/localStore";

function formatMeters(n: number) {
  return `${n.toLocaleString("en-IN")} M`;
}

function formatClock(d: Date) {
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="live-chip" aria-live="polite">
      <span className="live-dot" aria-hidden />
      Live · {formatClock(now)}
    </div>
  );
}

function Dashboard({
  filter,
  setFilter,
}: {
  filter: LoomStatus | "all";
  setFilter: (f: LoomStatus | "all") => void;
}) {
  const looms = useMemo(() => buildLooms(), []);
  const fillPct = Math.min(100, (production.actual / production.target) * 100);
  const visible =
    filter === "all" ? looms : looms.filter((l) => l.status === filter);

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Operations Dashboard</h2>
          <p className="subtitle">
            Air jet loom fleet status and today&apos;s production at a glance.
          </p>
        </div>
        <LiveClock />
      </header>

      <div className="section-head">
        <h3>Loom Fleet</h3>
        <span>Real-time shed overview</span>
      </div>
      <div className="fleet-grid">
        <article className="panel stat">
          <span className="label">Total Looms</span>
          <div className="value">{fleet.total}</div>
          <div className="hint">Installed capacity</div>
        </article>
        <article className="panel stat running">
          <span className="label">Running</span>
          <div className="value">{fleet.running}</div>
          <div className="hint">
            {((fleet.running / fleet.total) * 100).toFixed(1)}% of fleet
          </div>
        </article>
        <article className="panel stat stopped">
          <span className="label">Stopped</span>
          <div className="value">{fleet.stopped}</div>
          <div className="hint">Idle / changeover</div>
        </article>
        <article className="panel stat breakdown">
          <span className="label">Breakdown</span>
          <div className="value">{fleet.breakdown}</div>
          <div className="hint">Needs attention</div>
        </article>
      </div>

      <div className="production-layout">
        <section className="panel prod-panel">
          <div className="section-head">
            <h3>Today Production</h3>
            <span>Meters woven</span>
          </div>
          <div className="prod-metrics">
            <div className="metric-block">
              <span className="label">Target</span>
              <div className="value">{formatMeters(production.target)}</div>
            </div>
            <div className="metric-block">
              <span className="label">Actual</span>
              <div className="value">{formatMeters(production.actual)}</div>
            </div>
            <div className="metric-block">
              <span className="label">Efficiency</span>
              <div className="value">{production.efficiency}%</div>
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-meta">
              <span>Target attainment</span>
              <span>{fillPct.toFixed(1)}%</span>
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={fillPct} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="progress-fill"
                style={{ ["--fill" as string]: `${fillPct}%` }}
              />
            </div>
          </div>
          <div className="type-split">
            <div className="type-card">
              <div className="name">Dobby</div>
              <div className="pct">{production.dobby}%</div>
            </div>
            <div className="type-card plain">
              <div className="name">Plain</div>
              <div className="pct">{production.plain}%</div>
            </div>
          </div>
        </section>

        <section className="panel ops-panel">
          <div className="section-head">
            <h3>Operations Pulse</h3>
            <span>Action queue</span>
          </div>
          <div className="ops-grid">
            <div className="op-row">
              <div className="left">
                <span className="op-icon crit">BD</span>
                <span className="title">Breakdown Today</span>
              </div>
              <span className="count">{operations.breakdownToday}</span>
            </div>
            <div className="op-row">
              <div className="left">
                <span className="op-icon warn">MT</span>
                <span className="title">Maintenance Pending</span>
              </div>
              <span className="count">{operations.maintenancePending}</span>
            </div>
            <div className="op-row">
              <div className="left">
                <span className="op-icon info">ST</span>
                <span className="title">Low Stock Items</span>
              </div>
              <span className="count">{operations.lowStockItems}</span>
            </div>
            <div className="op-row">
              <div className="left">
                <span className="op-icon teal">PO</span>
                <span className="title">Purchase Pending</span>
              </div>
              <span className="count">{operations.purchasePending}</span>
            </div>
            <div className="op-row">
              <div className="left">
                <span className="op-icon crit">SA</span>
                <span className="title">Security Alerts</span>
              </div>
              <span className="count">{operations.securityAlerts}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Loom Board</h3>
          <span>
            Showing {visible.length} of {looms.length}
          </span>
        </div>
        <div className="filters" role="tablist" aria-label="Filter looms by status">
          {(
            [
              ["all", "All"],
              ["running", "Running"],
              ["stopped", "Stopped"],
              ["breakdown", "Breakdown"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? "active" : undefined}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loom</th>
                <th>Shed</th>
                <th>Type</th>
                <th>Status</th>
                <th>Efficiency</th>
                <th>Today (M)</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 24).map((loom) => (
                <tr key={loom.id}>
                  <td>{loom.id}</td>
                  <td>{loom.shed}</td>
                  <td>{loom.type}</td>
                  <td>
                    <span className={`badge ${loom.status}`}>{loom.status}</span>
                  </td>
                  <td>{loom.efficiency.toFixed(1)}%</td>
                  <td>{loom.metersToday.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SectionPage({
  title,
  blurb,
  kpis,
}: {
  title: string;
  blurb: string;
  kpis: { label: string; value: string }[];
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <h2>{title}</h2>
          <p className="subtitle">{blurb}</p>
        </div>
        <LiveClock />
      </header>
      <section className="panel page-card">
        <h3>{title} summary</h3>
        <p>
          Module connected to the central air jet loom management feed. Figures
          below mirror today&apos;s control-room totals.
        </p>
        <div className="kpi-row">
          {kpis.map((k) => (
            <div className="metric-block" key={k.label}>
              <span className="label">{k.label}</span>
              <div className="value">{k.value}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function SecurityModule({ page }: { page: SecurityNavId }) {
  const navigate = useNavigate();
  switch (page) {
    case "security-dashboard":
      return (
        <SecurityDashboard
          onNavigate={(id) => navigate(`/security/${id}`)}
        />
      );
    case "visitor-requests":
      return <VisitorRequestsPage />;
    case "ceo-requests":
      return <CeoVisitRequestsPage />;
    case "visitors-inside":
      return <VisitorsInsidePage />;
    case "gate-pass":
      return <GatePassPage />;
    case "vehicles":
      return <VehicleManagementPage />;
    case "material-gate":
      return <MaterialGatePage />;
    case "incidents":
      return <SecurityIncidentsPage />;
    case "history":
      return <VisitorHistoryPage />;
    case "reports":
      return <SecurityReportsPage />;
    case "notifications":
      return <NotificationsPage />;
    case "settings":
      return <SecuritySettingsPage />;
    default:
      return <SecurityDashboard onNavigate={(id) => navigate(`/security/${id}`)} />;
  }
}

function AppShell() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<LoomStatus | "all">("all");
  const [unread, setUnread] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const inSecurity = location.pathname.startsWith("/security");
  const loomNav: LoomNavId = useMemo(() => {
    const p = location.pathname.replace(/^\//, "") || "dashboard";
    if (p.startsWith("security")) return "security";
    if (loomNavItems.some((n) => n.id === p)) return p as LoomNavId;
    return "dashboard";
  }, [location.pathname]);

  const securityPage: SecurityNavId = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] === "security" && parts[1]) {
      const id = parts[1] as SecurityNavId;
      if (securityNavItems.some((n) => n.id === id)) return id;
    }
    return "security-dashboard";
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    async function loadN() {
      const list = await listNotifications(user!);
      setUnread(list.filter((n) => !n.is_read).length);
      const latest = list.find((n) => !n.is_read && n.notification_type.startsWith("CEO_"));
      if (latest) setFlash(latest.message);
    }
    void loadN();
    if (!isSupabaseConfigured) return subscribeStore(() => void loadN());
  }, [user, location.pathname]);

  if (loading) {
    return <div className="loading-block full">Loading OPA ERP…</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  const showSecurityNav = canAccessSecurity(user.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            OPA
          </div>
          <h1>OPA Group of India</h1>
          <p>Air Jet Loom Management System</p>
        </div>
        <nav className="nav" aria-label="Primary">
          {loomNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={loomNav === item.id && !inSecurity ? "active" : undefined}
              onClick={() => {
                if (item.id === "security") navigate("/security/security-dashboard");
                else navigate(`/${item.id === "dashboard" ? "" : item.id}`);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {inSecurity && showSecurityNav && (
          <nav className="nav security-subnav" aria-label="Security">
            <div className="nav-section-label">Security</div>
            {securityNavItems.map((item) => {
              if (item.id === "ceo-requests" && !hasPermission(user.role, "ceo.requests.view") && !hasPermission(user.role, "admin.full") && !hasPermission(user.role, "security.dashboard")) {
                return null;
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  className={securityPage === item.id ? "active" : undefined}
                  onClick={() => navigate(`/security/${item.id}`)}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        <div className="sidebar-foot">
          Plant control room · Shed A &amp; B
          <br />
          Fleet capacity {fleet.total} air jet looms
        </div>
      </aside>

      <div className="main-wrap">
        <div className="app-topstrip">
          <div>
            <strong>OPA Group of India</strong>
            <span className="muted"> · {formatClock(new Date()).split(",")[0]}</span>
          </div>
          <div className="topstrip-right">
            <LiveClock />
            <button type="button" className="btn tiny ghost" onClick={() => navigate("/security/notifications")}>
              Alerts{unread ? ` (${unread})` : ""}
            </button>
            <div className="profile-chip">
              <span>{user.full_name}</span>
              <em>{ROLE_LABELS[user.role]}</em>
            </div>
            <button type="button" className="btn tiny" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>

        {flash && inSecurity && (
          <div className="banner success flash-banner">
            {flash}
            <button type="button" className="icon-btn" onClick={() => setFlash(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <main className="main">
          {!inSecurity && loomNav === "dashboard" && (
            <Dashboard filter={filter} setFilter={setFilter} />
          )}
          {!inSecurity && loomNav === "looms" && (
            <SectionPage
              title="Looms"
              blurb="Monitor individual machine status across both sheds."
              kpis={[
                { label: "Total", value: String(fleet.total) },
                { label: "Running", value: String(fleet.running) },
                { label: "Stopped", value: String(fleet.stopped) },
                { label: "Breakdown", value: String(fleet.breakdown) },
              ]}
            />
          )}
          {!inSecurity && loomNav === "production" && (
            <SectionPage
              title="Production"
              blurb="Daily output versus target for dobby and plain weaves."
              kpis={[
                { label: "Target", value: formatMeters(production.target) },
                { label: "Actual", value: formatMeters(production.actual) },
                { label: "Efficiency", value: `${production.efficiency}%` },
                { label: "Dobby", value: `${production.dobby}%` },
                { label: "Plain", value: `${production.plain}%` },
              ]}
            />
          )}
          {!inSecurity && loomNav === "maintenance" && (
            <SectionPage
              title="Maintenance"
              blurb="Breakdown response and scheduled service backlog."
              kpis={[
                { label: "Breakdown Today", value: String(operations.breakdownToday) },
                { label: "Pending Jobs", value: String(operations.maintenancePending) },
              ]}
            />
          )}
          {!inSecurity && loomNav === "inventory" && (
            <SectionPage
              title="Inventory"
              blurb="Spares and consumables below reorder level."
              kpis={[{ label: "Low Stock Items", value: String(operations.lowStockItems) }]}
            />
          )}
          {!inSecurity && loomNav === "purchase" && (
            <SectionPage
              title="Purchase"
              blurb="Open purchase requests awaiting approval or receipt."
              kpis={[{ label: "Purchase Pending", value: String(operations.purchasePending) }]}
            />
          )}
          {inSecurity && showSecurityNav && <SecurityModule page={securityPage} />}
          {inSecurity && !showSecurityNav && (
            <section className="panel page-card">
              <h3>Access denied</h3>
              <p>Your role does not include security module access.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/ceo-approval/:id" element={<CeoApprovalPage />} />
      <Route path="/security/:page" element={<AppShell />} />
      <Route path="/security" element={<Navigate to="/security/security-dashboard" replace />} />
      <Route path="/:section" element={<AppShell />} />
      <Route path="/" element={<AppShell />} />
    </Routes>
  );
}
