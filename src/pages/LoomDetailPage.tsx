import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { listRows, type Row } from "@/lib/api";
import { buildDemoLooms, buildDemoProductionEntries, getDemoRows } from "@/lib/demoData";
import { useAuth } from "@/context/AuthContext";
import type { LoomStatus, OpaLoom } from "@/types/database";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  TextSelect,
  StatCard,
  DataTable,
  AlertBanner,
  type Column,
} from "@/components/ui";

/** Loom Detail — links Production / Stoppage / Quality / Maintenance without changing Loom Dashboard. */
export default function LoomDetailPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [loom, setLoom] = useState<OpaLoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fromDemo, setFromDemo] = useState(false);
  const [entries, setEntries] = useState<Row[]>([]);
  const [stoppages, setStoppages] = useState<Row[]>([]);
  const [quality, setQuality] = useState<Row[]>([]);
  const [maint, setMaint] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const demoLooms = buildDemoLooms();
      const sb = getSupabase();
      let loaded: OpaLoom | null = null;
      let demo = false;

      if (!sb) {
        loaded = demoLooms.find((l) => l.id === id) ?? demoLooms[0] ?? null;
        demo = true;
      } else {
        try {
          const { data, error: err } = await sb
            .from("opa_looms")
            .select("*")
            .eq("id", id!)
            .maybeSingle();
          if (err) throw err;
          if (data) loaded = data as OpaLoom;
          else {
            loaded = demoLooms.find((l) => l.id === id) ?? null;
            demo = true;
            if (!loaded) setError("Loom not found");
          }
        } catch (e) {
          if (!cancelled) {
            setError(
              e instanceof Error ? e.message : "Failed to load loom — using demo",
            );
            loaded = demoLooms.find((l) => l.id === id) ?? demoLooms[0] ?? null;
            demo = true;
          }
        }
      }

      if (cancelled) return;
      setLoom(loaded);
      setFromDemo(demo);

      if (loaded) {
        const loomId = loaded.id;
        const [pe, st, qc, mr] = await Promise.all([
          listRows("opa_production_entries", {
            orderBy: { column: "entry_date", ascending: false },
            limit: 20,
            filters: { loom_id: loomId },
            demoRows: buildDemoProductionEntries(demoLooms).filter(
              (e) => e.loom_id === loomId,
            ) as unknown as Row[],
          }),
          listRows("opa_loom_stoppages", {
            orderBy: { column: "start_time", ascending: false },
            limit: 20,
            filters: { loom_id: loomId },
            demoRows: getDemoRows("opa_loom_stoppages").filter(
              (r) => r.loom_id === loomId,
            ),
          }),
          listRows("opa_quality_inspections", {
            orderBy: { column: "inspection_date", ascending: false },
            limit: 20,
            filters: { loom_id: loomId },
            demoRows: getDemoRows("opa_quality_inspections").filter(
              (r) => r.loom_id === loomId,
            ),
          }),
          listRows("opa_maintenance_requests", {
            orderBy: { column: "created_at", ascending: false },
            limit: 20,
            filters: { loom_id: loomId },
            demoRows: getDemoRows("opa_maintenance_requests").filter(
              (r) => r.loom_id === loomId,
            ),
          }),
        ]);
        if (!cancelled) {
          setEntries(pe.data);
          setStoppages(st.data);
          setQuality(qc.data);
          setMaint(mr.data);
          if (pe.fromDemo || st.fromDemo || qc.fromDemo || mr.fromDemo) {
            setFromDemo(true);
          }
        }
      }

      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const metrics = useMemo(() => {
    const todayMeters = entries.reduce(
      (s, e) => s + Number(e.production_meter ?? 0),
      0,
    );
    const avgEff =
      entries.length === 0
        ? 0
        : entries.reduce((s, e) => s + Number(e.efficiency ?? 0), 0) /
          entries.length;
    const openStops = stoppages.filter((s) => !s.end_time).length;
    const openMaint = maint.filter(
      (m) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(String(m.status ?? "")),
    ).length;
    return { todayMeters, avgEff, openStops, openMaint };
  }, [entries, stoppages, maint]);

  async function updateStatus(status: LoomStatus) {
    if (!loom) return;
    setSaving(true);
    const prev = loom.status;
    setLoom({ ...loom, status });
    const sb = getSupabase();
    if (!sb || fromDemo) {
      setSaving(false);
      return;
    }
    try {
      const { error: err } = await sb
        .from("opa_looms")
        .update({ status } as never)
        .eq("id", loom.id);
      if (err) throw err;
      await writeAuditLog({
        user_id: profile?.id,
        user_name: profile?.full_name,
        action: "UPDATE_STATUS",
        module: "looms",
        record_id: loom.id,
        old_value: { status: prev },
        new_value: { status },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      setLoom({ ...loom, status: prev });
    } finally {
      setSaving(false);
    }
  }

  const entryCols: Column<Row>[] = [
    { key: "entry_date", header: "Date", render: (r) => String(r.entry_date ?? "—") },
    {
      key: "production_meter",
      header: "Meters",
      render: (r) => Number(r.production_meter ?? 0).toLocaleString("en-IN"),
    },
    {
      key: "efficiency",
      header: "Eff %",
      render: (r) => (r.efficiency != null ? `${r.efficiency}` : "—"),
    },
  ];
  const stopCols: Column<Row>[] = [
    { key: "reason", header: "Reason", render: (r) => String(r.reason ?? "—") },
    {
      key: "start_time",
      header: "Start",
      render: (r) => String(r.start_time ?? "—").slice(0, 16),
    },
    {
      key: "end_time",
      header: "End",
      render: (r) => (r.end_time ? String(r.end_time).slice(0, 16) : "Open"),
    },
  ];
  const qcCols: Column<Row>[] = [
    {
      key: "inspection_number",
      header: "Inspection",
      render: (r) => String(r.inspection_number ?? "—"),
    },
    { key: "result", header: "Result", render: (r) => <StatusBadge status={String(r.result ?? "—")} /> },
    {
      key: "rejected_meters",
      header: "Rejected",
      render: (r) => String(r.rejected_meters ?? r.sample_meters ?? "—"),
    },
  ];
  const maintCols: Column<Row>[] = [
    {
      key: "request_number",
      header: "Request",
      render: (r) => String(r.request_number ?? "—"),
    },
    { key: "priority", header: "Priority", render: (r) => String(r.priority ?? "—") },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={String(r.status ?? "—")} /> },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Loom detail" subtitle="Loading…" />
        <LoadingState />
      </>
    );
  }

  if (!loom) {
    return (
      <>
        <PageHeader title="Loom detail" subtitle="Not found" />
        <ErrorState message={error ?? "Loom not found"} />
        <p>
          <Link to="/looms">Back to looms</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={loom.loom_number}
        subtitle={`${loom.loom_type} · ${loom.location ?? "Unassigned"}`}
        actions={
          <div className="btn-row">
            <Link className="btn btn-ghost" to="/production">
              Production
            </Link>
            <Link className="btn btn-ghost" to="/stoppages">
              Stoppages
            </Link>
            <Link className="btn btn-ghost" to="/looms">
              ← All looms
            </Link>
          </div>
        }
        meta={<StatusBadge status={loom.status} />}
      />

      {fromDemo ? (
        <AlertBanner tone="info" title="Demo / offline data">
          Related production, stoppage, quality and maintenance rows are shown from
          demo data until `opa_*` migrations are applied.
        </AlertBanner>
      ) : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="fleet-grid">
        <StatCard label="Type" value={loom.loom_type} />
        <StatCard label="Production (listed)" value={metrics.todayMeters.toLocaleString("en-IN")} tone="running" />
        <StatCard label="Avg efficiency" value={`${metrics.avgEff.toFixed(1)}%`} />
        <StatCard label="Open stoppages" value={metrics.openStops} tone={metrics.openStops ? "breakdown" : undefined} />
        <StatCard label="Open maintenance" value={metrics.openMaint} tone={metrics.openMaint ? "amber" : undefined} />
        <StatCard label="Article" value={loom.current_article ?? "—"} />
      </div>

      <section className="panel page-card">
        <h3>Status control</h3>
        <p>Update live machine status. Changes are audited.</p>
        <TextSelect
          label="Status"
          value={loom.status}
          disabled={saving}
          onChange={(e) => void updateStatus(e.target.value as LoomStatus)}
        >
          {(["RUNNING", "STOPPED", "BREAKDOWN", "MAINTENANCE", "IDLE"] as LoomStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </TextSelect>
        <dl className="detail-grid">
          <div>
            <dt>Serial</dt>
            <dd>{loom.serial_number ?? "—"}</dd>
          </div>
          <div>
            <dt>Width</dt>
            <dd>{loom.width ?? "—"}</dd>
          </div>
          <div>
            <dt>Reed / Pick</dt>
            <dd>
              {loom.reed ?? "—"} / {loom.pick ?? "—"}
            </dd>
          </div>
          <div>
            <dt>Controller</dt>
            <dd>{loom.controller ?? "—"}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{loom.notes ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Production history</h3>
          <Link to="/production">Open module</Link>
        </div>
        <DataTable columns={entryCols} rows={entries} rowKey={(r) => r.id} pageSize={8} />
      </section>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Stoppages / downtime</h3>
          <Link to="/stoppages">Open module</Link>
        </div>
        <DataTable columns={stopCols} rows={stoppages} rowKey={(r) => r.id} pageSize={8} />
      </section>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Quality inspections</h3>
          <Link to="/quality">Open module</Link>
        </div>
        <DataTable columns={qcCols} rows={quality} rowKey={(r) => r.id} pageSize={8} />
      </section>

      <section className="panel table-panel">
        <div className="section-head">
          <h3>Maintenance</h3>
          <Link to="/maintenance/requests">Open module</Link>
        </div>
        <DataTable columns={maintCols} rows={maint} rowKey={(r) => r.id} pageSize={8} />
      </section>
    </>
  );
}
