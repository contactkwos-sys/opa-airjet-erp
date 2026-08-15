import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { buildDemoLooms, buildDemoProductionEntries } from "@/lib/demoData";
import { displayLoomNumber } from "@/lib/loomCodes";
import { useAuth } from "@/context/AuthContext";
import type { LoomStatus, OpaLoom, OpaProductionEntry } from "@/types/database";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  TextSelect,
  StatCard,
} from "@/components/ui";

export default function LoomDetailPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [loom, setLoom] = useState<OpaLoom | null>(null);
  const [entries, setEntries] = useState<OpaProductionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const sb = getSupabase();
      const demo = buildDemoLooms();
      if (!sb) {
        const found = demo.find((l) => l.id === id) ?? demo[0];
        if (!cancelled) {
          setLoom(found);
          setEntries(buildDemoProductionEntries(demo).filter((e) => e.loom_id === found.id));
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error: err } = await sb
          .from("opa_looms")
          .select("*")
          .eq("id", id!)
          .maybeSingle();
        if (err) throw err;
        if (!cancelled) {
          if (data) {
            setLoom(data as OpaLoom);
            const pe = await sb
              .from("opa_production_entries")
              .select("*")
              .eq("loom_id", id!)
              .order("entry_date", { ascending: false })
              .limit(20);
            setEntries((pe.data as OpaProductionEntry[]) ?? []);
          } else {
            const d = demo.find((l) => l.id === id);
            setLoom(d ?? null);
            if (d) setEntries(buildDemoProductionEntries(demo).filter((e) => e.loom_id === d.id));
            if (!d) setError("Loom not found");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          const d = demo.find((l) => l.id === id) ?? null;
          setLoom(d);
          if (d) setEntries(buildDemoProductionEntries(demo).filter((e) => e.loom_id === d.id));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const today = new Date().toISOString().slice(0, 10);
  const todayProd = useMemo(
    () =>
      entries
        .filter((e) => e.entry_date === today)
        .reduce((s, e) => s + (Number(e.production_meter) || 0), 0),
    [entries, today],
  );
  const avgEff = useMemo(() => {
    if (!entries.length) return 0;
    return entries.reduce((s, e) => s + (Number(e.efficiency) || 0), 0) / entries.length;
  }, [entries]);
  const runHours = useMemo(
    () => entries.reduce((s, e) => s + (Number(e.running_hours) || 0), 0),
    [entries],
  );
  const stopHours = useMemo(
    () => entries.reduce((s, e) => s + (Number(e.downtime_hours) || 0), 0),
    [entries],
  );

  async function updateStatus(status: LoomStatus) {
    if (!loom) return;
    setSaving(true);
    const prev = loom.status;
    setLoom({ ...loom, status });
    const sb = getSupabase();
    if (!sb) {
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
        title={displayLoomNumber(loom)}
        subtitle={`${loom.loom_type} · ${loom.location ?? "Unassigned"} · ${loom.department ?? "Production"}`}
        actions={
          <Link className="btn btn-ghost" to="/looms">
            ← All looms
          </Link>
        }
        meta={<StatusBadge status={loom.status} />}
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="fleet-grid">
        <StatCard label="Current status" value={loom.status} />
        <StatCard label="Today's production" value={`${todayProd.toLocaleString("en-IN")} M`} tone="running" />
        <StatCard label="Efficiency" value={`${avgEff.toFixed(1)}%`} />
        <StatCard label="RPM" value={loom.rpm ?? "—"} />
        <StatCard label="Running hours" value={runHours.toFixed(1)} />
        <StatCard label="Stop hours" value={stopHours.toFixed(1)} tone="stopped" />
        <StatCard label="Operator" value={loom.operator_name ?? "—"} />
        <StatCard label="Capacity" value={loom.production_capacity ?? "—"} />
      </div>

      <section className="panel page-card">
        <h3>Status control</h3>
        <p>Admin/supervisor can update live machine status. Changes are audited.</p>
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
            <dt>Loom code</dt>
            <dd>{loom.loom_code ?? displayLoomNumber(loom)}</dd>
          </div>
          <div>
            <dt>Make / model</dt>
            <dd>
              {loom.make ?? "—"} {loom.model ?? ""}
            </dd>
          </div>
          <div>
            <dt>Serial</dt>
            <dd>{loom.serial_number ?? "—"}</dd>
          </div>
          <div>
            <dt>Installation</dt>
            <dd>{loom.installation_date ?? "—"}</dd>
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
            <dt>Article / quality</dt>
            <dd>
              {loom.current_article ?? "—"} / {loom.current_quality ?? "—"}
            </dd>
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
          <span>
            <Link to="/production">All entries</Link>
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Shift</th>
                <th>Meters</th>
                <th>Kg</th>
                <th>Eff %</th>
                <th>Downtime</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6}>No production history yet.</td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.entry_date}</td>
                    <td>{e.shift_code ?? "—"}</td>
                    <td>{e.production_meter}</td>
                    <td>{e.production_kg ?? "—"}</td>
                    <td>{e.efficiency ?? "—"}</td>
                    <td>{e.downtime_hours ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel page-card">
        <h3>Maintenance & spares</h3>
        <p>
          Breakdown and PM history for this loom are available under{" "}
          <Link to="/maintenance/breakdown">Breakdown analytics</Link> and{" "}
          <Link to="/maintenance/pm">Preventive maintenance</Link>. Spare issues deduct from
          inventory automatically when recorded on work orders.
        </p>
      </section>
    </>
  );
}
