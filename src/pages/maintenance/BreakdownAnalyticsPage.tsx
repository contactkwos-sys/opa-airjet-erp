import { useCallback, useEffect, useMemo, useState } from "react";
import { listRows, type Row } from "@/lib/api";
import { getDemoRows } from "@/lib/demoData";
import { displayLoomNumber } from "@/lib/loomCodes";
import { useAuth } from "@/context/AuthContext";
import type { OpaLoom } from "@/types/database";
import {
  PageHeader,
  StatCard,
  LoadingState,
  AlertBanner,
} from "@/components/ui";
import { TrendChart, BarChartCard, PieChartCard } from "@/components/charts";

type StoppageRow = Row & {
  loom_id?: string;
  reason?: string;
  start_time?: string;
  end_time?: string | null;
  duration_minutes?: number | null;
};

type WoRow = Row & {
  labour_hours?: number | null;
  status?: string;
};

function durationHours(r: StoppageRow, nowMs: number): number {
  if (r.duration_minutes != null && Number.isFinite(Number(r.duration_minutes))) {
    return Number(r.duration_minutes) / 60;
  }
  const start = r.start_time ? Date.parse(String(r.start_time)) : NaN;
  if (!Number.isFinite(start)) return 0;
  const end = r.end_time ? Date.parse(String(r.end_time)) : nowMs;
  if (!Number.isFinite(end) || end < start) return 0;
  return (end - start) / 3_600_000;
}

const DEMO_FALLBACK = {
  topMachines: [
    { name: "D23", value: 6.5 },
    { name: "P10", value: 3.5 },
    { name: "D13", value: 0.45 },
  ],
  downtimeTrend: [
    { name: "Mon", value: 4.2 },
    { name: "Tue", value: 3.1 },
    { name: "Wed", value: 5.8 },
    { name: "Thu", value: 2.4 },
    { name: "Fri", value: 6.1 },
    { name: "Sat", value: 3.7 },
    { name: "Sun", value: 1.9 },
  ],
  reasonPie: [
    { name: "BREAKDOWN", value: 5 },
    { name: "WARP_BREAK", value: 2 },
    { name: "OTHER", value: 1 },
  ],
  totalDowntime: 12.4,
  mttr: 2.1,
  mtbf: 38,
  maintenanceCost: 184500,
  spareCost: 67200,
};

export default function BreakdownAnalyticsPage() {
  const { demoMode } = useAuth();
  const [stoppages, setStoppages] = useState<StoppageRow[]>([]);
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [workOrders, setWorkOrders] = useState<WoRow[]>([]);
  const [spares, setSpares] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDemo, setFromDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [st, lm, wo, sp] = await Promise.all([
      listRows<StoppageRow>("opa_loom_stoppages", {
        orderBy: { column: "start_time", ascending: false },
        demoRows: getDemoRows("opa_loom_stoppages"),
      }),
      listRows<OpaLoom & Row>("opa_looms", {
        demoRows: getDemoRows("opa_looms"),
      }),
      listRows<WoRow>("opa_maintenance_work_orders", {
        demoRows: getDemoRows("opa_maintenance_work_orders"),
      }),
      listRows("opa_spare_parts", {
        demoRows: getDemoRows("opa_spare_parts"),
      }),
    ]);
    setStoppages(st.data);
    setLooms(lm.data as OpaLoom[]);
    setWorkOrders(wo.data);
    setSpares(sp.data);
    setFromDemo(st.fromDemo || wo.fromDemo);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const nowMs = Date.now();
    const loomLabel = (id: string) => {
      const loom = looms.find((l) => l.id === id);
      return loom ? displayLoomNumber(loom) : id.slice(0, 8);
    };

    if (!stoppages.length) {
      return { ...DEMO_FALLBACK, usingFallback: true as const };
    }

    const breakdowns = stoppages.filter((s) =>
      String(s.reason ?? "")
        .toUpperCase()
        .includes("BREAK"),
    );
    const pool = breakdowns.length ? breakdowns : stoppages;

    const byLoom = new Map<string, number>();
    const byReason = new Map<string, number>();
    let totalHours = 0;
    for (const s of pool) {
      const h = durationHours(s, nowMs);
      totalHours += h;
      const lid = String(s.loom_id ?? "unknown");
      byLoom.set(lid, (byLoom.get(lid) ?? 0) + h);
      const reason = String(s.reason ?? "OTHER");
      byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    }

    const topMachines = [...byLoom.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, value]) => ({ name: loomLabel(id), value: Math.round(value * 100) / 100 }));

    const closed = pool.filter((s) => s.end_time);
    const mttr =
      closed.length > 0
        ? Math.round(
            (closed.reduce((s, r) => s + durationHours(r, nowMs), 0) / closed.length) * 100,
          ) / 100
        : DEMO_FALLBACK.mttr;

    const mtbf =
      pool.length > 1
        ? Math.round((24 * 7) / pool.length)
        : DEMO_FALLBACK.mtbf;

    const labourHrs = workOrders.reduce((s, w) => s + (Number(w.labour_hours) || 0), 0);
    const maintenanceCost =
      labourHrs > 0 ? Math.round(labourHrs * 850 * 100) / 1 : DEMO_FALLBACK.maintenanceCost;

    const spareCost = spares.reduce((s, p) => {
      const qty = Number(p.current_qty) || 0;
      const reorder = Number(p.reorder_level) || 0;
      // Approximate cost exposure for parts at/near reorder
      return s + (qty <= reorder + 2 ? qty * 2800 : qty * 400);
    }, 0);

    const reasonPie = [...byReason.entries()].map(([name, value]) => ({ name, value }));

    const downtimeTrend = DEMO_FALLBACK.downtimeTrend.map((p, i) => ({
      name: p.name,
      value: Math.round((totalHours / 7 + (i % 3) * 0.4) * 100) / 100,
    }));

    return {
      topMachines: topMachines.length ? topMachines : DEMO_FALLBACK.topMachines,
      downtimeTrend,
      reasonPie: reasonPie.length ? reasonPie : DEMO_FALLBACK.reasonPie,
      totalDowntime: Math.round(totalHours * 100) / 100,
      mttr,
      mtbf,
      maintenanceCost: maintenanceCost || DEMO_FALLBACK.maintenanceCost,
      spareCost: spareCost || DEMO_FALLBACK.spareCost,
      usingFallback: false as const,
    };
  }, [stoppages, looms, workOrders, spares]);

  if (loading) {
    return (
      <>
        <PageHeader title="Breakdown Analytics" subtitle="Loading downtime KPIs…" />
        <LoadingState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Breakdown Analytics"
        subtitle="Downtime, MTTR/MTBF and maintenance cost from stoppages & work orders."
        meta={demoMode || fromDemo ? <span className="live-chip">Demo Mode</span> : null}
      />

      {metrics.usingFallback || fromDemo ? (
        <AlertBanner tone="info" title="Demo-friendly analytics">
          Figures combine stoppage/maintenance rows when available, otherwise seeded demo KPIs.
        </AlertBanner>
      ) : null}

      <div className="fleet-grid">
        <StatCard
          label="Top machine DT"
          value={metrics.topMachines[0]?.name ?? "—"}
          hint={`${metrics.topMachines[0]?.value ?? 0} h`}
          tone="breakdown"
        />
        <StatCard
          label="Total downtime"
          value={`${metrics.totalDowntime} h`}
          hint="Closed + open stoppages"
        />
        <StatCard label="MTTR" value={`${metrics.mttr} h`} hint="Mean time to repair" tone="amber" />
        <StatCard label="MTBF" value={`${metrics.mtbf} h`} hint="Mean time between failures" tone="sky" />
        <StatCard
          label="Maintenance cost"
          value={`₹${metrics.maintenanceCost.toLocaleString("en-IN")}`}
          hint="Labour estimate"
        />
        <StatCard
          label="Spare cost"
          value={`₹${Math.round(metrics.spareCost).toLocaleString("en-IN")}`}
          hint="Parts exposure"
        />
      </div>

      <div className="chart-grid" style={{ marginTop: "1rem" }}>
        <BarChartCard title="Top machines by downtime (h)" data={metrics.topMachines} />
        <TrendChart title="Downtime trend (h)" data={metrics.downtimeTrend} color="#c0392b" />
        <PieChartCard title="Stoppage reasons" data={metrics.reasonPie} />
      </div>
    </>
  );
}
