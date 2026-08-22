import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import type { LoomStatus, OpaLoom } from "@/types/database";
import {
  PageHeader,
  LoadingState,
  StatusBadge,
  StatCard,
  EmptyState,
  ErrorState,
  TextInput,
} from "@/components/ui";

export default function FactoryFloorPage() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") as LoomStatus | null;
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LoomStatus | "ALL">(
    initialStatus && ["RUNNING", "STOPPED", "BREAKDOWN", "MAINTENANCE", "IDLE"].includes(initialStatus)
      ? initialStatus
      : "ALL",
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) {
          setLooms([]);
          setError("Database is not configured. No data available.");
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error: err } = await sb
          .from("opa_looms")
          .select("*")
          .eq("is_active", true)
          .order("loom_number");
        if (err) throw err;
        if (!cancelled) {
          setLooms((data as OpaLoom[]) ?? []);
        }
      } catch (e) {
        if (!cancelled) {
          setLooms([]);
          setError(e instanceof Error ? e.message : "Could not load looms");
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

  const counts = useMemo(() => {
    const c = { RUNNING: 0, STOPPED: 0, BREAKDOWN: 0, MAINTENANCE: 0, IDLE: 0 };
    for (const l of looms) c[l.status]++;
    return c;
  }, [looms]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return looms.filter((l) => {
      if (filter !== "ALL" && l.status !== filter) return false;
      if (!q) return true;
      const hay = [
        l.loom_number,
        l.current_article,
        l.loom_type,
        l.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [looms, filter, search]);

  return (
    <>
      <PageHeader
        title="Factory Floor"
        subtitle="Live loom board — tap a loom for details."
      />

      <div className="kpi-compact-grid floor-counts">
        <StatCard label="Running" value={counts.RUNNING} tone="running" onClick={() => setFilter("RUNNING")} />
        <StatCard label="Stopped" value={counts.STOPPED} tone="stopped" onClick={() => setFilter("STOPPED")} />
        <StatCard label="Breakdown" value={counts.BREAKDOWN} tone="breakdown" onClick={() => setFilter("BREAKDOWN")} />
        <StatCard label="Maintenance" value={counts.MAINTENANCE} onClick={() => setFilter("MAINTENANCE")} />
        <StatCard label="Idle" value={counts.IDLE} onClick={() => setFilter("IDLE")} />
      </div>

      <div className="floor-toolbar">
        <div className="filters">
          {(["ALL", "RUNNING", "STOPPED", "BREAKDOWN", "MAINTENANCE", "IDLE"] as const).map(
            (s) => (
              <button
                key={s}
                type="button"
                className={filter === s ? "active" : undefined}
                onClick={() => setFilter(s)}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ),
          )}
        </div>
        <TextInput
          label=""
          placeholder="Search loom / article / operator"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search looms"
        />
      </div>

      {loading ? (
        <LoadingState label="Loading loom data…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No loom records found"
          description={
            looms.length === 0
              ? "No looms were returned from the database."
              : "No looms match this filter or search."
          }
        />
      ) : (
        <div className="floor-grid">
          {visible.map((loom) => (
            <Link
              key={loom.id}
              to={`/looms/${loom.id}`}
              className={`floor-card compact status-${loom.status.toLowerCase()}`}
            >
              <div className="floor-card-top">
                <strong className="floor-loom-no">
                  {loom.loom_number.replace(" LOOM ", "")}
                </strong>
                <StatusBadge status={loom.status} />
              </div>
              <div className="floor-type">{loom.loom_type}</div>
              <div className="floor-detail-row">
                <span className="label">Article</span>
                <span>{loom.current_article ?? "—"}</span>
              </div>
              <div className="floor-detail-row">
                <span className="label">Operator</span>
                <span>—</span>
              </div>
              <div className="floor-metrics">
                <div>
                  <span className="label">RPM</span>
                  <strong>{loom.rpm ?? "—"}</strong>
                </div>
                <div>
                  <span className="label">Production</span>
                  <strong>—</strong>
                </div>
                <div>
                  <span className="label">Efficiency</span>
                  <strong>—</strong>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
