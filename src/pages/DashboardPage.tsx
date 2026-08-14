import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { getSupabase } from "@/lib/supabase";
import { buildDemoLooms, demoKpis } from "@/lib/demoData";
import type { LoomStatus, OpaAlert, OpaLoom } from "@/types/database";
import {
  PageHeader,
  StatCard,
  StatusBadge,
  LoadingState,
  AchievementIndicator,
  efficiencyLevel,
  AlertBanner,
} from "@/components/ui";
import { TrendChart, BarChartCard, PieChartCard } from "@/components/charts";

function formatMeters(n: number) {
  return `${n.toLocaleString("en-IN")} M`;
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
      Live · {format(now, "EEE, dd MMM · hh:mm:ss a")}
    </div>
  );
}

function countByStatus(looms: OpaLoom[]) {
  const counts = {
    total: looms.length,
    running: 0,
    stopped: 0,
    breakdown: 0,
    maintenance: 0,
    idle: 0,
  };
  for (const l of looms) {
    if (l.status === "RUNNING") counts.running++;
    else if (l.status === "STOPPED") counts.stopped++;
    else if (l.status === "BREAKDOWN") counts.breakdown++;
    else if (l.status === "MAINTENANCE") counts.maintenance++;
    else counts.idle++;
  }
  return counts;
}

export default function DashboardPage() {
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [alerts, setAlerts] = useState<OpaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) {
          setLooms(buildDemoLooms());
          setAlerts([
            {
              id: "a1",
              type: "BREAKDOWN",
              severity: "HIGH",
              title: "Loom breakdown — PLAIN LOOM 46",
              body: "Mechanical fault reported on Shed B",
              module: "looms",
              record_id: null,
              is_resolved: false,
              resolved_at: null,
              resolved_by: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: "a2",
              type: "STOCK",
              severity: "MEDIUM",
              title: "Low spare stock",
              body: "12 items below reorder level",
              module: "inventory",
              record_id: null,
              is_resolved: false,
              resolved_at: null,
              resolved_by: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]);
          setUsingDemo(true);
          setLoading(false);
        }
        return;
      }
      try {
        const [loomRes, alertRes] = await Promise.all([
          sb.from("opa_looms").select("*").eq("is_active", true).order("loom_number"),
          sb
            .from("opa_alerts")
            .select("*")
            .eq("is_resolved", false)
            .order("created_at", { ascending: false })
            .limit(8),
        ]);
        if (cancelled) return;
        if (loomRes.error || !loomRes.data?.length) {
          setLooms(buildDemoLooms());
          setUsingDemo(true);
        } else {
          setLooms(loomRes.data as OpaLoom[]);
        }
        if (alertRes.data?.length) {
          setAlerts(alertRes.data as OpaAlert[]);
        }
      } catch {
        if (!cancelled) {
          setLooms(buildDemoLooms());
          setUsingDemo(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fleetCounts = useMemo(() => countByStatus(looms), [looms]);
  const k = demoKpis;
  const fillPct = Math.min(100, (k.production.actual / k.production.target) * 100);
  const trend = useMemo(
    () =>
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, i) => ({
        name,
        value: Math.round(k.production.actual * (0.82 + i * 0.025)),
      })),
    [k.production.actual],
  );
  const statusPie = useMemo(
    () => [
      { name: "Running", value: fleetCounts.running },
      { name: "Stopped", value: fleetCounts.stopped },
      { name: "Breakdown", value: fleetCounts.breakdown },
      { name: "Other", value: fleetCounts.maintenance + fleetCounts.idle },
    ],
    [fleetCounts],
  );
  const shedBars = useMemo(() => {
    const shedA = looms.filter((l) => (l.location ?? "").includes("A") || l.loom_type === "DOBBY");
    const shedB = looms.filter((l) => !shedA.includes(l));
    return [
      {
        name: "Shed A",
        value: shedA.filter((l) => l.status === "RUNNING").length,
      },
      {
        name: "Shed B",
        value: shedB.filter((l) => l.status === "RUNNING").length,
      },
    ];
  }, [looms]);

  if (loading) {
    return (
      <>
        <PageHeader title="Operations Dashboard" subtitle="Loading plant KPIs…" />
        <LoadingState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Air jet loom fleet, production, and plant pulse at a glance."
        meta={<LiveClock />}
      />

      {usingDemo ? (
        <AlertBanner
          tone="info"
          title="Demo Mode KPIs"
          children="Showing seeded demo figures until Supabase returns live loom data."
        />
      ) : null}

      <div className="section-head">
        <h3>Loom Fleet</h3>
        <span>
          <Link to="/looms">View all looms</Link>
        </span>
      </div>
      <div className="fleet-grid">
        <StatCard label="Total Looms" value={fleetCounts.total || k.fleet.total} hint="Installed capacity" />
        <StatCard
          label="Running"
          value={fleetCounts.running}
          tone="running"
          hint={`${(((fleetCounts.running || 0) / (fleetCounts.total || 1)) * 100).toFixed(1)}% of fleet`}
        />
        <StatCard label="Stopped" value={fleetCounts.stopped} tone="stopped" hint="Idle / changeover" />
        <StatCard label="Breakdown" value={fleetCounts.breakdown} tone="breakdown" hint="Needs attention" />
      </div>

      <div className="kpi-row dash-kpi-extra">
        <StatCard label="Production today" value={formatMeters(k.production.actual)} hint={`Target ${formatMeters(k.production.target)}`} />
        <StatCard label="Efficiency" value={`${k.production.efficiency}%`} tone="running" />
        <StatCard label="Rejection" value={`${k.rejectionPct}%`} tone="amber" />
        <StatCard label="Downtime" value={`${k.downtimeHours} h`} tone="stopped" />
        <StatCard label="Cost / meter" value={`₹${k.costPerMeter}`} />
        <StatCard label="Inventory" value={`₹${k.inventoryValueLakh}L`} />
        <StatCard label="Purchase pending" value={`₹${k.purchasePendingValue}L`} tone="amber" />
        <StatCard label="Visitors today" value={k.visitorsToday} tone="sky" />
        <StatCard label="CEO meetings" value={k.ceoMeetingsPending} />
        <StatCard label="Dispatch" value={formatMeters(k.dispatchMeters)} />
        <StatCard label="Receivables" value={`₹${k.receivablesLakh}L`} />
        <div className="panel stat achievement-stat">
          <span className="label">Target attainment</span>
          <AchievementIndicator
            level={efficiencyLevel(fillPct)}
            label={`${fillPct.toFixed(1)}% of daily target`}
            value={`${k.production.efficiency}% eff`}
          />
        </div>
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
              <div className="value">{formatMeters(k.production.target)}</div>
            </div>
            <div className="metric-block">
              <span className="label">Actual</span>
              <div className="value">{formatMeters(k.production.actual)}</div>
            </div>
            <div className="metric-block">
              <span className="label">Efficiency</span>
              <div className="value">{k.production.efficiency}%</div>
            </div>
          </div>
          <div className="progress-wrap">
            <div className="progress-meta">
              <span>Target attainment</span>
              <span>{fillPct.toFixed(1)}%</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={fillPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="progress-fill" style={{ ["--fill" as string]: `${fillPct}%` }} />
            </div>
          </div>
          <div className="type-split">
            <div className="type-card">
              <div className="name">Dobby</div>
              <div className="pct">{k.production.dobby}%</div>
            </div>
            <div className="type-card plain">
              <div className="name">Plain</div>
              <div className="pct">{k.production.plain}%</div>
            </div>
          </div>
        </section>

        <section className="panel ops-panel">
          <div className="section-head">
            <h3>Operations Pulse</h3>
            <span>Action queue</span>
          </div>
          <div className="ops-grid">
            {[
              ["crit", "BD", "Breakdown Today", k.operations.breakdownToday],
              ["warn", "MT", "Maintenance Pending", k.operations.maintenancePending],
              ["info", "ST", "Low Stock Items", k.operations.lowStockItems],
              ["teal", "PO", "Purchase Pending", k.operations.purchasePending],
              ["crit", "SA", "Security Alerts", k.operations.securityAlerts],
            ].map(([tone, icon, title, count]) => (
              <div className="op-row" key={String(title)}>
                <div className="left">
                  <span className={`op-icon ${tone}`}>{icon}</span>
                  <span className="title">{title}</span>
                </div>
                <span className="count">{count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="chart-grid">
        <TrendChart title="7-day production trend" data={trend} />
        <BarChartCard title="Running looms by shed" data={shedBars} />
        <PieChartCard title="Fleet status mix" data={statusPie} />
      </div>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Active Alerts</h3>
          <span>
            <Link to="/alerts">Open alerts</Link>
          </span>
        </div>
        {alerts.length === 0 ? (
          <p className="table-empty">No unresolved alerts.</p>
        ) : (
          <ul className="alert-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <StatusBadge status={a.severity === "CRITICAL" || a.severity === "HIGH" ? "BREAKDOWN" : "STOPPED"}>
                  {a.severity}
                </StatusBadge>
                <div>
                  <strong>{a.title}</strong>
                  {a.body ? <p>{a.body}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Loom Board Snapshot</h3>
          <span>
            <Link to="/factory-floor">Factory floor</Link>
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Loom</th>
                <th>Location</th>
                <th>Type</th>
                <th>Status</th>
                <th>Article</th>
              </tr>
            </thead>
            <tbody>
              {looms.slice(0, 12).map((loom) => (
                <tr key={loom.id}>
                  <td>
                    <Link to={`/looms/${loom.id}`}>{loom.loom_number}</Link>
                  </td>
                  <td>{loom.location ?? "—"}</td>
                  <td>{loom.loom_type}</td>
                  <td>
                    <StatusBadge status={loom.status as LoomStatus} />
                  </td>
                  <td>{loom.current_article ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
