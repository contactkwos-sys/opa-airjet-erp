import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { useAuth } from "@/context/AuthContext";
import type { LoomStatus, OpaLoom } from "@/types/database";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) {
          setLoom(null);
          setError("Database is not configured. No data available.");
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
          if (data) setLoom(data as OpaLoom);
          else {
            setLoom(null);
            setError("Loom not found");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setLoom(null);
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

  async function updateStatus(status: LoomStatus) {
    if (!loom) return;
    setSaving(true);
    const prev = loom.status;
    setLoom({ ...loom, status });
    const sb = getSupabase();
    if (!sb) {
      setError("Database is not configured. Cannot update.");
      setLoom({ ...loom, status: prev });
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
        <ErrorState message={error ?? "No data available"} />
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
          <Link className="btn btn-ghost" to="/looms">
            ← All looms
          </Link>
        }
        meta={<StatusBadge status={loom.status} />}
      />

      {error ? <ErrorState message={error} /> : null}

      <div className="fleet-grid">
        <StatCard label="Type" value={loom.loom_type} />
        <StatCard label="RPM" value={loom.rpm ?? "—"} />
        <StatCard label="Article" value={loom.current_article ?? "—"} />
        <StatCard label="Make / model" value={`${loom.make ?? "—"} ${loom.model ?? ""}`.trim()} />
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
    </>
  );
}
