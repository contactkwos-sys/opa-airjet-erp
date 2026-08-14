import { useCallback, useEffect, useMemo, useState } from "react";
import { listRows, type Row } from "@/lib/api";
import { buildDemoLooms, buildDemoProductionEntries, demoKpis } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  StatCard,
  DataTable,
  LoadingState,
  type Column,
} from "@/components/ui";

export default function DailyReportPage() {
  const { demoMode } = useAuth();
  const [entries, setEntries] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listRows("opa_production_entries", {
      orderBy: { column: "entry_date", ascending: false },
      demoRows: buildDemoProductionEntries(buildDemoLooms()) as unknown as Row[],
    });
    setEntries(result.data.filter((e) => String(e.entry_date) === today));
    setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const meters = entries.reduce((s, e) => s + Number(e.production_meter ?? 0), 0);
    const eff =
      entries.length === 0
        ? demoKpis.production.efficiency
        : entries.reduce((s, e) => s + Number(e.efficiency ?? 0), 0) /
          entries.length;
    return { meters, eff, count: entries.length };
  }, [entries]);

  const columns: Column<Row>[] = [
    { key: "entry_number", header: "Entry #", render: (r) => String(r.entry_number ?? "—") },
    { key: "loom_id", header: "Loom", render: (r) => String(r.loom_id ?? "—") },
    {
      key: "production_meter",
      header: "Meters",
      render: (r) => Number(r.production_meter ?? 0).toLocaleString("en-IN"),
    },
    {
      key: "efficiency",
      header: "Efficiency",
      render: (r) => (r.efficiency != null ? `${r.efficiency}%` : "—"),
    },
  ];

  return (
    <>
      <PageHeader
        title="Daily Report"
        subtitle={`Shift and day-end production summary · ${today}`}
        meta={demoMode ? <span className="live-chip">Demo Mode</span> : null}
      />
      <div className="fleet-grid">
        <StatCard label="Entries" value={summary.count} />
        <StatCard
          label="Production (M)"
          value={summary.meters.toLocaleString("en-IN")}
        />
        <StatCard label="Avg efficiency" value={`${summary.eff.toFixed(1)}%`} />
        <StatCard label="Rejection" value={`${demoKpis.rejectionPct}%`} />
      </div>
      <section className="panel table-panel">
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable columns={columns} rows={entries} rowKey={(r) => r.id} />
        )}
      </section>
    </>
  );
}
