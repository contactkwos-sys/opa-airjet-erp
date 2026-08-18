import { useCallback, useEffect, useMemo, useState } from "react";
import { listRows, type Row } from "@/lib/api";
import {
  PageHeader,
  StatCard,
  DataTable,
  LoadingState,
  ErrorState,
  EmptyState,
  type Column,
} from "@/components/ui";

export default function DailyReportPage() {
  const [entries, setEntries] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectionPct, setRejectionPct] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [entryRes, failRes, passRes] = await Promise.all([
      listRows("opa_production_entries", {
        orderBy: { column: "entry_date", ascending: false },
      }),
      listRows("opa_quality_inspections", {
        select: "id",
        filters: { result: "FAIL" },
        limit: 500,
      }),
      listRows("opa_quality_inspections", {
        select: "id",
        filters: { result: "PASS" },
        limit: 500,
      }),
    ]);
    if (entryRes.error) setError(entryRes.error);
    setEntries(entryRes.data.filter((e) => String(e.entry_date) === today));
    const qcTotal = failRes.data.length + passRes.data.length;
    setRejectionPct(
      qcTotal > 0 ? Math.round((failRes.data.length / qcTotal) * 1000) / 10 : 0,
    );
    setLoading(false);
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const meters = entries.reduce((s, e) => s + Number(e.production_meter ?? 0), 0);
    const eff =
      entries.length === 0
        ? 0
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
      />
      <div className="fleet-grid">
        <StatCard label="Entries" value={summary.count} />
        <StatCard
          label="Production (M)"
          value={summary.meters.toLocaleString("en-IN")}
        />
        <StatCard label="Avg efficiency" value={`${summary.eff.toFixed(1)}%`} />
        <StatCard label="Rejection" value={`${rejectionPct}%`} />
      </div>
      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : null}
        {!loading && !error && entries.length === 0 ? (
          <EmptyState
            title="No data available"
            description="No production entries for today."
          />
        ) : null}
        {!loading && !error && entries.length > 0 ? (
          <DataTable columns={columns} rows={entries} rowKey={(r) => r.id} />
        ) : null}
      </section>
    </>
  );
}
