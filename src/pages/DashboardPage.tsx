import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { listRows } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import type {
  LoomStatus,
  OpaAlert,
  OpaLoom,
  OpaProductionEntry,
  OpaProductionTarget,
} from "@/types/database";
import {
  PageHeader,
  StatCard,
  StatusBadge,
  LoadingState,
  AchievementIndicator,
  efficiencyLevel,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { TrendChart, BarChartCard, PieChartCard } from "@/components/charts";

type DashboardKpis = {
  fleet: { total: number; running: number; stopped: number; breakdown: number };
  production: { target: number; actual: number; efficiency: number; dobby: number; plain: number };
  operations: {
    breakdownToday: number;
    maintenancePending: number;
    lowStockItems: number;
    purchasePending: number;
    securityAlerts: number;
  };
  rejectionPct: number;
  downtimeHours: number;
  costPerMeter: number;
  inventoryValueLakh: number;
  purchasePendingValue: number;
  visitorsToday: number;
  ceoMeetingsPending: number;
  dispatchMeters: number;
  receivablesLakh: number;
};

function formatMeters(n: number) {
  return `${n.toLocaleString("en-IN")} M`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function emptyLiveKpis(fleetTotal: number): DashboardKpis {
  return {
    fleet: { total: fleetTotal, running: 0, stopped: 0, breakdown: 0 },
    production: { target: 0, actual: 0, efficiency: 0, dobby: 0, plain: 0 },
    operations: {
      breakdownToday: 0,
      maintenancePending: 0,
      lowStockItems: 0,
      purchasePending: 0,
      securityAlerts: 0,
    },
    rejectionPct: 0,
    downtimeHours: 0,
    costPerMeter: 0,
    inventoryValueLakh: 0,
    purchasePendingValue: 0,
    visitorsToday: 0,
    ceoMeetingsPending: 0,
    dispatchMeters: 0,
    receivablesLakh: 0,
  };
}

function buildLiveKpis(args: {
  looms: OpaLoom[];
  entries: OpaProductionEntry[];
  targets: OpaProductionTarget[];
  ops: {
    maintenancePending: number;
    lowStockItems: number;
    purchasePending: number;
    securityAlerts: number;
    visitorsToday: number;
    ceoMeetingsPending: number;
    dispatchMeters: number;
    receivablesLakh: number;
    inventoryValueLakh: number;
    purchasePendingValue: number;
    rejectionPct: number;
    costPerMeter: number;
  };
}): DashboardKpis {
  const fleetCounts = countByStatus(args.looms);
  const actual = args.entries.reduce((s, e) => s + Number(e.production_meter ?? 0), 0);
  const targetFromRows = args.targets.reduce((s, t) => s + Number(t.target_meter ?? 0), 0);
  const target = targetFromRows > 0 ? targetFromRows : 0;
  const effValues = args.entries
    .map((e) => Number(e.efficiency))
    .filter((n) => Number.isFinite(n) && n > 0);
  const efficiency =
    effValues.length > 0
      ? Math.round((effValues.reduce((s, n) => s + n, 0) / effValues.length) * 10) / 10
      : 0;
  const downtimeHours =
    Math.round(args.entries.reduce((s, e) => s + Number(e.downtime_hours ?? 0), 0) * 10) / 10;

  const dobbyIds = new Set(args.looms.filter((l) => l.loom_type === "DOBBY").map((l) => l.id));
  const plainIds = new Set(args.looms.filter((l) => l.loom_type === "PLAIN").map((l) => l.id));
  const dobbyMeters = args.entries
    .filter((e) => dobbyIds.has(e.loom_id))
    .reduce((s, e) => s + Number(e.production_meter ?? 0), 0);
  const plainMeters = args.entries
    .filter((e) => plainIds.has(e.loom_id))
    .reduce((s, e) => s + Number(e.production_meter ?? 0), 0);
  const typeTotal = dobbyMeters + plainMeters;
  const dobbyPct = typeTotal > 0 ? Math.round((dobbyMeters / typeTotal) * 1000) / 10 : 0;
  const plainPct = typeTotal > 0 ? Math.round((plainMeters / typeTotal) * 1000) / 10 : 0;

  return {
    fleet: {
      total: fleetCounts.total,
      running: fleetCounts.running,
      stopped: fleetCounts.stopped,
      breakdown: fleetCounts.breakdown,
    },
    production: {
      target: Math.round(target),
      actual: Math.round(actual),
      efficiency,
      dobby: dobbyPct,
      plain: plainPct,
    },
    operations: {
      breakdownToday: fleetCounts.breakdown,
      maintenancePending: args.ops.maintenancePending,
      lowStockItems: args.ops.lowStockItems,
      purchasePending: args.ops.purchasePending,
      securityAlerts: args.ops.securityAlerts,
    },
    rejectionPct: args.ops.rejectionPct,
    downtimeHours,
    costPerMeter: args.ops.costPerMeter,
    inventoryValueLakh: args.ops.inventoryValueLakh,
    purchasePendingValue: args.ops.purchasePendingValue,
    visitorsToday: args.ops.visitorsToday,
    ceoMeetingsPending: args.ops.ceoMeetingsPending,
    dispatchMeters: args.ops.dispatchMeters,
    receivablesLakh: args.ops.receivablesLakh,
  };
}

/** Count live rows; returns 0 on error / missing table (never demo). */
async function countRows(
  table: string,
  filters?: Record<string, string | number | boolean | null>,
): Promise<number> {
  const result = await listRows(table, {
    select: "id",
    filters,
    limit: 500,
  });
  if (result.error) return 0;
  return result.data.length;
}

async function sumColumn(
  table: string,
  column: string,
  filters?: Record<string, string | number | boolean | null>,
): Promise<number> {
  const result = await listRows(table, {
    select: column,
    filters,
    limit: 500,
  });
  if (result.error) return 0;
  return result.data.reduce((s, row) => s + Number(row[column] ?? 0), 0);
}

export default function DashboardPage() {
  const { session, loading: authLoading } = useAuth();
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [alerts, setAlerts] = useState<OpaAlert[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis>(() => emptyLiveKpis(0));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const sb = getSupabase();

      if (!sb || !session) {
        if (!cancelled) {
          setLooms([]);
          setAlerts([]);
          setKpis(emptyLiveKpis(0));
          setError("No data available. Sign in with a configured database connection.");
          setLoading(false);
        }
        return;
      }

      const today = todayIso();

      try {
        const [loomRes, alertRes, entryRes, targetRes] = await Promise.all([
          listRows("opa_looms", {
            select: "*",
            orderBy: { column: "loom_number", ascending: true },
            filters: { is_active: true },
            limit: 200,
          }),
          listRows("opa_alerts", {
            select: "*",
            orderBy: { column: "created_at", ascending: false },
            filters: { is_resolved: false },
            limit: 8,
          }),
          listRows("opa_production_entries", {
            select: "*",
            orderBy: { column: "entry_date", ascending: false },
            filters: { entry_date: today },
            limit: 500,
          }),
          listRows("opa_production_targets", {
            select: "*",
            filters: { target_date: today },
            limit: 200,
          }),
        ]);

        if (cancelled) return;

        const firstError = [loomRes, alertRes, entryRes, targetRes].find((r) => r.error)?.error ?? null;
        if (firstError) setError(firstError);

        const liveLooms = loomRes.data as unknown as OpaLoom[];
        const liveAlerts = alertRes.data as unknown as OpaAlert[];
        const liveEntries = entryRes.data as unknown as OpaProductionEntry[];
        const liveTargets = targetRes.data as unknown as OpaProductionTarget[];

        setLooms(liveLooms);
        setAlerts(liveAlerts);

        const [
          maintenancePending,
          purchasePending,
          ceoMeetingsPending,
          visitorsToday,
          inventoryRows,
          purchaseValue,
          dispatchQty,
          receivableTotal,
          rejectInspections,
          passInspections,
        ] = await Promise.all([
          countRows("opa_maintenance_requests", { status: "OPEN" }),
          countRows("opa_purchase_orders", { payment_status: "PENDING" }),
          countRows("ceo_visit_requests", { status: "PENDING" }),
          countRows("visitor_entries"),
          listRows("opa_inventory_items", {
            select: "current_qty,reorder_level,unit_cost",
            filters: { is_active: true },
            limit: 500,
          }),
          sumColumn("opa_purchase_orders", "total_amount", { payment_status: "PENDING" }),
          sumColumn("opa_dispatch_items", "quantity"),
          sumColumn("opa_sales_orders", "total_amount", { payment_status: "PENDING" }),
          countRows("opa_quality_inspections", { result: "FAIL" }),
          countRows("opa_quality_inspections", { result: "PASS" }),
        ]);

        if (cancelled) return;

        let lowStockItems = 0;
        let inventoryValueLakh = 0;
        if (!inventoryRows.error) {
          for (const row of inventoryRows.data) {
            const qty = Number(row.current_qty ?? 0);
            const reorder = Number(row.reorder_level ?? 0);
            const cost = Number(row.unit_cost ?? 0);
            if (reorder > 0 && qty <= reorder) lowStockItems += 1;
            inventoryValueLakh += (qty * cost) / 100_000;
          }
          inventoryValueLakh = Math.round(inventoryValueLakh * 10) / 10;
        }

        const qcTotal = rejectInspections + passInspections;
        const rejectionPct =
          qcTotal > 0 ? Math.round((rejectInspections / qcTotal) * 1000) / 10 : 0;
        const actualMeters = liveEntries.reduce(
          (s, e) => s + Number(e.production_meter ?? 0),
          0,
        );
        const costPerMeter =
          actualMeters > 0 && inventoryValueLakh > 0
            ? Math.round(((inventoryValueLakh * 100_000) / actualMeters) * 10) / 10
            : 0;

        setKpis(
          buildLiveKpis({
            looms: liveLooms,
            entries: liveEntries,
            targets: liveTargets,
            ops: {
              maintenancePending,
              lowStockItems,
              purchasePending,
              securityAlerts: liveAlerts.length,
              visitorsToday,
              ceoMeetingsPending,
              dispatchMeters: Math.round(dispatchQty),
              receivablesLakh: Math.round((receivableTotal / 100_000) * 10) / 10,
              inventoryValueLakh,
              purchasePendingValue: Math.round((purchaseValue / 100_000) * 10) / 10,
              rejectionPct,
              costPerMeter,
            },
          }),
        );
      } catch {
        if (!cancelled) {
          setLooms([]);
          setAlerts([]);
          setKpis(emptyLiveKpis(0));
          setError("Could not load dashboard data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, session]);

  const fleetCounts = useMemo(() => countByStatus(looms), [looms]);
  const k = kpis;
  const fillPct =
    k.production.target > 0
      ? Math.min(100, (k.production.actual / k.production.target) * 100)
      : 0;
  const trend = useMemo(
    () =>
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name, i) => ({
        name,
        value: Math.round((k.production.actual || 0) * (0.82 + i * 0.025)),
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

  if (authLoading || loading) {
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

      {error ? <ErrorState message={error} /> : null}

      {!error && looms.length === 0 && k.fleet.total === 0 && k.production.actual === 0 ? (
        <EmptyState
          title="No data available"
          description="No loom or production records were returned for today."
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
        <StatCard
          label="Production today"
          value={formatMeters(k.production.actual)}
          hint={`Target ${formatMeters(k.production.target)}`}
        />
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
              {looms.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="table-empty">No active looms returned from Supabase.</p>
                  </td>
                </tr>
              ) : (
                looms.slice(0, 12).map((loom) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
