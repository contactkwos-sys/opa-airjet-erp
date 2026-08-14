import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { getSupabase } from "@/lib/supabase";
import { buildDemoLooms, buildDemoProductionEntries } from "@/lib/demoData";
import { buildPlantMetrics } from "@/lib/plantMetrics";
import { displayLoomNumber } from "@/lib/loomCodes";
import { achievementRag } from "@/lib/productionCalc";
import type { LoomStatus, OpaAlert, OpaLoom, OpaProductionEntry } from "@/types/database";
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
  return `${Math.round(n).toLocaleString("en-IN")} M`;
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

export default function DashboardPage() {
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [entries, setEntries] = useState<OpaProductionEntry[]>([]);
  const [alerts, setAlerts] = useState<OpaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const demoLooms = buildDemoLooms();
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) {
          setLooms(demoLooms);
          setEntries(buildDemoProductionEntries(demoLooms));
          setAlerts([
            {
              id: "a1",
              type: "BREAKDOWN",
              severity: "HIGH",
              title: "Loom breakdown — P10",
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
        const [loomRes, alertRes, entryRes] = await Promise.all([
          sb.from("opa_looms").select("*").eq("is_active", true).order("loom_number"),
          sb
            .from("opa_alerts")
            .select("*")
            .eq("is_resolved", false)
            .order("created_at", { ascending: false })
            .limit(8),
          sb
            .from("opa_production_entries")
            .select("*")
            .order("entry_date", { ascending: false })
            .limit(200),
        ]);
        if (cancelled) return;
        if (loomRes.error || !loomRes.data?.length) {
          setLooms(demoLooms);
          setEntries(buildDemoProductionEntries(demoLooms));
          setUsingDemo(true);
        } else {
          setLooms(loomRes.data as OpaLoom[]);
          if (entryRes.data?.length) setEntries(entryRes.data as OpaProductionEntry[]);
          else setEntries(buildDemoProductionEntries(loomRes.data as OpaLoom[]));
        }
        if (alertRes.data?.length) setAlerts(alertRes.data as OpaAlert[]);
      } catch {
        if (!cancelled) {
          setLooms(demoLooms);
          setEntries(buildDemoProductionEntries(demoLooms));
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

  const m = useMemo(() => buildPlantMetrics({ looms, entries }), [looms, entries]);
  const rag = achievementRag(m.achievement);
  const statusPie = useMemo(
    () => [
      { name: "Running", value: m.fleet.running },
      { name: "Stopped", value: m.fleet.stopped },
      { name: "Breakdown", value: m.fleet.breakdown },
      { name: "Maintenance", value: m.fleet.maintenance },
      { name: "Idle", value: m.fleet.idle },
    ],
    [m.fleet],
  );

  if (loading) {
    return (
      <>
        <PageHeader title="ERP Dashboard" subtitle="Loading plant KPIs…" />
        <LoadingState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="OPA Air Jet ERP Dashboard"
        subtitle="72 air-jet looms · live plant, production, stores, purchase, maintenance & security."
        meta={<LiveClock />}
      />

      {usingDemo ? (
        <AlertBanner tone="info" title="Demo Mode KPIs">
          Showing seeded demo figures until Supabase returns live loom data for opa-airjet-erp.
        </AlertBanner>
      ) : null}

      <div className="section-head">
        <h3>Loom Fleet</h3>
        <span>
          <Link to="/looms">Loom Master</Link>
        </span>
      </div>
      <div className="fleet-grid">
        <StatCard label="Total Looms" value={m.fleet.total || 72} hint="Installed capacity" />
        <StatCard label="Dobby" value={m.fleet.dobby || 36} hint="D01–D36" tone="sky" />
        <StatCard label="Plain" value={m.fleet.plain || 36} hint="P01–P36" />
        <StatCard
          label="Running"
          value={m.fleet.running}
          tone="running"
          hint={`${(((m.fleet.running || 0) / (m.fleet.total || 1)) * 100).toFixed(1)}% of fleet`}
        />
        <StatCard label="Stopped" value={m.fleet.stopped} tone="stopped" />
        <StatCard label="Under Maintenance" value={m.fleet.maintenance} tone="amber" />
      </div>

      <div className="kpi-row dash-kpi-extra">
        <StatCard label="Today's Production" value={formatMeters(m.todayProduction)} />
        <StatCard label="MTD Production" value={formatMeters(m.mtdProduction)} />
        <StatCard label="Production Target" value={formatMeters(m.targetMeter)} />
        <StatCard
          label="Target Achievement %"
          value={`${m.achievement.toFixed(1)}%`}
          tone={rag === "green" ? "running" : rag === "amber" ? "amber" : "breakdown"}
        />
        <StatCard label="Efficiency %" value={`${m.efficiency}%`} tone="running" />
        <StatCard label="Downtime" value={`${m.downtimeHours} h`} tone="stopped" />
        <StatCard label="Yarn Stock" value={`${m.yarnStock.toLocaleString("en-IN")} kg`} />
        <StatCard label="Beam Stock" value={m.beamStock} />
        <StatCard label="Fabric Stock" value={formatMeters(m.fabricStock)} />
        <StatCard label="Spare Stock" value={m.spareStock} />
        <StatCard label="Purchase Pending" value={m.purchasePending} tone="amber" />
        <StatCard label="GRN Pending" value={m.grnPending} tone="amber" />
        <StatCard label="Maintenance Pending" value={m.maintenancePending} tone="amber" />
        <StatCard label="Security Visitors Today" value={m.visitorsToday} tone="sky" />
        <StatCard label="CEO Meeting Pending" value={m.ceoPending} />
        <div className="panel stat achievement-stat">
          <span className="label">Target attainment</span>
          <AchievementIndicator
            level={efficiencyLevel(m.achievement)}
            label={`${m.achievement.toFixed(1)}% of daily target`}
            value={`${m.efficiency}% eff`}
          />
        </div>
      </div>

      <div className="chart-grid">
        <TrendChart title="Daily production" data={m.dailyTrend} />
        <BarChartCard title="Loom-wise production" data={m.loomWise} />
        <PieChartCard title="Dobby vs Plain" data={m.dobbyVsPlain} />
        <TrendChart title="Efficiency %" data={m.efficiencyTrend} />
        <BarChartCard title="Downtime by reason" data={m.downtimeByReason} />
        <TrendChart title="Yarn consumption" data={m.yarnConsumption} />
        <BarChartCard title="Monthly production" data={m.monthlyProduction} />
        <BarChartCard title="Maintenance cost" data={m.maintenanceCost} />
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
                <StatusBadge
                  status={
                    a.severity === "CRITICAL" || a.severity === "HIGH" ? "BREAKDOWN" : "STOPPED"
                  }
                >
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
                <th>Operator</th>
                <th>Article</th>
              </tr>
            </thead>
            <tbody>
              {looms.slice(0, 12).map((loom) => (
                <tr key={loom.id}>
                  <td>
                    <Link to={`/looms/${loom.id}`}>{displayLoomNumber(loom)}</Link>
                  </td>
                  <td>{loom.location ?? "—"}</td>
                  <td>{loom.loom_type}</td>
                  <td>
                    <StatusBadge status={loom.status as LoomStatus} />
                  </td>
                  <td>{loom.operator_name ?? "—"}</td>
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
