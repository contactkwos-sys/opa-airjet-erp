import { useEffect, useMemo, useState } from "react";
import {
  buildLooms,
  fleet,
  navItems,
  operations,
  production,
  type LoomStatus,
  type NavId,
} from "./data";

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

export default function App() {
  const [nav, setNav] = useState<NavId>("dashboard");
  const [filter, setFilter] = useState<LoomStatus | "all">("all");

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
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={nav === item.id ? "active" : undefined}
              onClick={() => setNav(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          Plant control room · Shed A &amp; B
          <br />
          Fleet capacity {fleet.total} air jet looms
        </div>
      </aside>

      <main className="main">
        {nav === "dashboard" && (
          <Dashboard filter={filter} setFilter={setFilter} />
        )}
        {nav === "looms" && (
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
        {nav === "production" && (
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
        {nav === "maintenance" && (
          <SectionPage
            title="Maintenance"
            blurb="Breakdown response and scheduled service backlog."
            kpis={[
              {
                label: "Breakdown Today",
                value: String(operations.breakdownToday),
              },
              {
                label: "Pending Jobs",
                value: String(operations.maintenancePending),
              },
            ]}
          />
        )}
        {nav === "inventory" && (
          <SectionPage
            title="Inventory"
            blurb="Spares and consumables below reorder level."
            kpis={[
              {
                label: "Low Stock Items",
                value: String(operations.lowStockItems),
              },
            ]}
          />
        )}
        {nav === "purchase" && (
          <SectionPage
            title="Purchase"
            blurb="Open purchase requests awaiting approval or receipt."
            kpis={[
              {
                label: "Purchase Pending",
                value: String(operations.purchasePending),
              },
            ]}
          />
        )}
        {nav === "security" && (
          <SectionPage
            title="Security"
            blurb="Gate and shed access exceptions requiring review."
            kpis={[
              {
                label: "Security Alerts",
                value: String(operations.securityAlerts),
              },
            ]}
          />
        )}
      </main>
    </div>
  );
}
