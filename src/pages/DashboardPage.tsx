import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { listRows } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import type {
  LoomStatus,
  OpaAlert,
  OpaLoom,
  OpaProductionEntry,
  OpaProductionTarget,
} from "@/types/database";
import {
  StatCard,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorState,
} from "@/components/ui";

type DashboardKpis = {
  fleet: {
    total: number;
    running: number;
    stopped: number;
    breakdown: number;
    maintenance: number;
    idle: number;
  };
  production: { target: number; actual: number; efficiency: number };
  downtimeHours: number;
  yarnStock: number;
  beamStock: number;
  greigeStock: number;
  spareStock: number;
  purchasePending: number;
  grnPending: number;
  maintenancePending: number;
  securityVisitors: number;
  managementAlerts: number;
};

function formatMeters(n: number) {
  return `${n.toLocaleString("en-IN")} M`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentShift(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Shift A";
  if (h >= 14 && h < 22) return "Shift B";
  return "Shift C";
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

function emptyKpis(): DashboardKpis {
  return {
    fleet: { total: 0, running: 0, stopped: 0, breakdown: 0, maintenance: 0, idle: 0 },
    production: { target: 0, actual: 0, efficiency: 0 },
    downtimeHours: 0,
    yarnStock: 0,
    beamStock: 0,
    greigeStock: 0,
    spareStock: 0,
    purchasePending: 0,
    grnPending: 0,
    maintenancePending: 0,
    securityVisitors: 0,
    managementAlerts: 0,
  };
}

async function countRows(
  table: string,
  filters?: Record<string, string | number | boolean | null>,
): Promise<number> {
  const result = await listRows(table, { select: "id", filters, limit: 500 });
  if (result.error) return 0;
  return result.data.length;
}

async function sumColumn(
  table: string,
  column: string,
  filters?: Record<string, string | number | boolean | null>,
): Promise<number> {
  const result = await listRows(table, { select: column, filters, limit: 500 });
  if (result.error) return 0;
  return result.data.reduce((s, row) => s + Number(row[column] ?? 0), 0);
}

type ActionItem = {
  severity: "critical" | "warning" | "info";
  label: string;
  to: string;
};

export default function DashboardPage() {
  const { session, loading: authLoading, role } = useAuth();
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [alerts, setAlerts] = useState<OpaAlert[]>([]);
  const [recentEntries, setRecentEntries] = useState<OpaProductionEntry[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis>(emptyKpis);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const live = isSupabaseConfigured() && Boolean(session);

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
          setKpis(emptyKpis());
          setError("No live production data available. Sign in with a configured database connection.");
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
            limit: 10,
          }),
          listRows("opa_production_entries", {
            select: "*",
            orderBy: { column: "created_at", ascending: false },
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
        setRecentEntries(liveEntries.slice(0, 5));

        const fleet = countByStatus(liveLooms);
        const actual = liveEntries.reduce((s, e) => s + Number(e.production_meter ?? 0), 0);
        const targetFromRows = liveTargets.reduce((s, t) => s + Number(t.target_meter ?? 0), 0);
        const effValues = liveEntries
          .map((e) => Number(e.efficiency))
          .filter((n) => Number.isFinite(n) && n > 0);
        const efficiency =
          effValues.length > 0
            ? Math.round((effValues.reduce((s, n) => s + n, 0) / effValues.length) * 10) / 10
            : targetFromRows > 0 && actual > 0
              ? Math.round((actual / targetFromRows) * 1000) / 10
              : 0;
        const downtimeHours =
          Math.round(liveEntries.reduce((s, e) => s + Number(e.downtime_hours ?? 0), 0) * 10) / 10;

        const [
          maintenancePending,
          purchasePending,
          grnPending,
          visitorsToday,
          yarnStock,
          beamStock,
          greigeStock,
          spareStock,
        ] = await Promise.all([
          countRows("opa_maintenance_requests", { status: "OPEN" }),
          countRows("opa_purchase_orders", { payment_status: "PENDING" }),
          countRows("opa_grns", { status: "PENDING" }),
          countRows("visitor_entries"),
          sumColumn("opa_yarn_master", "current_stock_kg"),
          countRows("opa_beams", { status: "AVAILABLE" }),
          sumColumn("opa_greige_stock", "quantity_meter"),
          countRows("opa_spare_parts"),
        ]);

        if (cancelled) return;

        setKpis({
          fleet,
          production: {
            target: Math.round(targetFromRows),
            actual: Math.round(actual),
            efficiency,
          },
          downtimeHours,
          yarnStock: Math.round(yarnStock),
          beamStock,
          greigeStock: Math.round(greigeStock),
          spareStock,
          purchasePending,
          grnPending,
          maintenancePending,
          securityVisitors: visitorsToday,
          managementAlerts: liveAlerts.length,
        });
      } catch {
        if (!cancelled) {
          setLooms([]);
          setAlerts([]);
          setKpis(emptyKpis());
          setError("Unable to load dashboard data.");
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

  const actionItems = useMemo((): ActionItem[] => {
    const items: ActionItem[] = [];
    const breakdownLooms = looms.filter((l) => l.status === "BREAKDOWN");
    for (const loom of breakdownLooms.slice(0, 2)) {
      items.push({
        severity: "critical",
        label: `Loom ${loom.loom_number.replace(" LOOM ", " ")} Breakdown`,
        to: `/looms/${loom.id}`,
      });
    }
    if (kpis.spareStock > 0 && kpis.maintenancePending > 0) {
      items.push({
        severity: "warning",
        label: "Spare Reorder Required",
        to: "/spares",
      });
    }
    if (kpis.purchasePending > 0) {
      items.push({
        severity: "warning",
        label: "Purchase Approval Pending",
        to: "/purchase-orders",
      });
    }
    if (kpis.maintenancePending > 0) {
      items.push({
        severity: "info",
        label: "Maintenance Pending",
        to: "/maintenance/requests",
      });
    }
    for (const alert of alerts.slice(0, 5 - items.length)) {
      if (items.length >= 5) break;
      items.push({
        severity:
          alert.severity === "CRITICAL" || alert.severity === "HIGH"
            ? "critical"
            : alert.severity === "MEDIUM"
              ? "warning"
              : "info",
        label: alert.title,
        to: "/alerts",
      });
    }
    return items.slice(0, 5);
  }, [looms, kpis, alerts]);

  const plantRunning =
    kpis.fleet.total > 0 && kpis.fleet.running > kpis.fleet.total * 0.5;

  if (authLoading || loading) {
    return <LoadingState label="Loading plant data…" />;
  }

  return (
    <div className="dash-industrial">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Plant Operations Dashboard</h1>
          <p className="dash-meta">
            {format(new Date(), "dd MMM yyyy")} · {currentShift()} ·{" "}
            {role?.replace(/_/g, " ") ?? "—"}
          </p>
        </div>
        <span className={`live-badge${live ? " live" : " offline"}`}>
          <span className="live-dot" aria-hidden />
          {live ? "LIVE" : "OFFLINE"}
        </span>
      </header>

      {error ? <ErrorState message={error} /> : null}

      {!error && looms.length === 0 && kpis.fleet.total === 0 ? (
        <EmptyState
          title="No live production data available"
          description="Connect to Supabase and ensure loom records exist for today."
        />
      ) : null}

      {/* Plant Status */}
      <section className="panel plant-status-bar">
        <div className="plant-status-main">
          <span className={`plant-status-dot${plantRunning ? " running" : " stopped"}`} />
          <strong>{plantRunning ? "RUNNING" : "ATTENTION"}</strong>
          <span className="plant-status-looms">
            {kpis.fleet.running} / {kpis.fleet.total || looms.length} Looms
          </span>
        </div>
        <div className="plant-status-metrics">
          <div>
            <span className="label">Efficiency</span>
            <strong>{kpis.production.efficiency}%</strong>
          </div>
          <div>
            <span className="label">Production</span>
            <strong>{formatMeters(kpis.production.actual)}</strong>
          </div>
          <div>
            <span className="label">Alerts</span>
            <strong>{kpis.managementAlerts}</strong>
          </div>
        </div>
      </section>

      {/* Fleet KPIs Row 1 */}
      <div className="kpi-compact-grid">
        <StatCard label="Total Looms" value={kpis.fleet.total} to="/looms" />
        <StatCard label="Running" value={kpis.fleet.running} tone="running" to="/factory-floor" />
        <StatCard label="Stopped" value={kpis.fleet.stopped} tone="stopped" to="/factory-floor" />
        <StatCard label="Breakdown" value={kpis.fleet.breakdown} tone="breakdown" to="/factory-floor?status=BREAKDOWN" />
        <StatCard label="Maintenance" value={kpis.fleet.maintenance} to="/maintenance/requests" />
      </div>

      {/* Production KPIs Row 2 */}
      <div className="kpi-compact-grid">
        <StatCard
          label="Today's Production"
          value={formatMeters(kpis.production.actual)}
          to="/production"
        />
        <StatCard label="Target" value={formatMeters(kpis.production.target)} to="/targets" />
        <StatCard
          label="Achievement %"
          value={
            kpis.production.target > 0
              ? `${Math.round((kpis.production.actual / kpis.production.target) * 1000) / 10}%`
              : "—"
          }
          to="/targets"
        />
        <StatCard label="Efficiency %" value={`${kpis.production.efficiency}%`} tone="running" to="/production" />
        <StatCard label="Downtime" value={`${kpis.downtimeHours} h`} tone="stopped" to="/stoppages" />
      </div>

      {/* Stock KPIs Row 3 */}
      <div className="kpi-compact-grid">
        <StatCard label="Yarn Stock" value={`${kpis.yarnStock} kg`} to="/yarn" />
        <StatCard label="Beam Stock" value={kpis.beamStock} to="/beams" />
        <StatCard label="Greige/Fabric" value={formatMeters(kpis.greigeStock)} to="/greige" />
        <StatCard label="Spare Stock" value={kpis.spareStock} to="/spares" />
      </div>

      {/* Pending KPIs Row 4 */}
      <div className="kpi-compact-grid">
        <StatCard label="Purchase Pending" value={kpis.purchasePending} tone="amber" to="/purchase-orders" />
        <StatCard label="GRN Pending" value={kpis.grnPending} tone="amber" to="/grn" />
        <StatCard label="Maint. Pending" value={kpis.maintenancePending} tone="amber" to="/maintenance/requests" />
        <StatCard label="Security Visitors" value={kpis.securityVisitors} to="/security/visitors" />
        <StatCard label="Mgmt Alerts" value={kpis.managementAlerts} to="/alerts" />
      </div>

      {/* Action Required */}
      {actionItems.length > 0 ? (
        <section className="panel action-required">
          <h3 className="section-title">Action Required</h3>
          <ul className="action-list">
            {actionItems.map((item) => (
              <li key={item.label} className={`action-item ${item.severity}`}>
                <Link to={item.to}>
                  <span className={`action-dot ${item.severity}`} aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Quick Access */}
      <section className="panel quick-access">
        <h3 className="section-title">Quick Access</h3>
        <div className="quick-links">
          {[
            ["Production", "/production"],
            ["Factory Floor", "/factory-floor"],
            ["Stores", "/inventory"],
            ["Maintenance", "/maintenance/requests"],
            ["Purchase", "/requisitions"],
            ["Security", "/security"],
          ].map(([label, to]) => (
            <Link key={to} to={to} className="quick-link">
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="panel recent-activity">
        <div className="section-head">
          <h3 className="section-title">Recent Activity</h3>
          <Link to="/audit">View all</Link>
        </div>
        {recentEntries.length === 0 && alerts.length === 0 ? (
          <p className="muted">No recent activity recorded today.</p>
        ) : (
          <ul className="activity-list">
            {recentEntries.map((e) => (
              <li key={e.id}>
                <span className="activity-time">
                  {e.created_at
                    ? format(new Date(e.created_at), "HH:mm")
                    : "—"}
                </span>
                <span>Production Entry {e.entry_number}</span>
              </li>
            ))}
            {alerts.slice(0, 3).map((a) => (
              <li key={a.id}>
                <span className="activity-time">
                  {a.created_at
                    ? format(new Date(a.created_at), "HH:mm")
                    : "—"}
                </span>
                <StatusBadge
                  status={
                    (a.severity === "CRITICAL" ? "BREAKDOWN" : "STOPPED") as LoomStatus
                  }
                />
                <span>{a.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
