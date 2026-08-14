import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { buildDemoLooms } from "@/lib/demoData";
import type { LoomStatus, OpaLoom } from "@/types/database";
import {
  PageHeader,
  LoadingState,
  StatusBadge,
  StatCard,
} from "@/components/ui";

export default function FactoryFloorPage() {
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LoomStatus | "ALL">("ALL");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) {
          setLooms(buildDemoLooms());
          setLoading(false);
        }
        return;
      }
      try {
        const { data } = await sb.from("opa_looms").select("*").order("loom_number");
        if (!cancelled) {
          setLooms(data?.length ? (data as OpaLoom[]) : buildDemoLooms());
        }
      } catch {
        if (!cancelled) setLooms(buildDemoLooms());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (filter === "ALL" ? looms : looms.filter((l) => l.status === filter)),
    [looms, filter],
  );

  const counts = useMemo(() => {
    const c = { RUNNING: 0, STOPPED: 0, BREAKDOWN: 0, MAINTENANCE: 0, IDLE: 0 };
    for (const l of looms) c[l.status]++;
    return c;
  }, [looms]);

  return (
    <>
      <PageHeader
        title="Factory Floor"
        subtitle="Live shed board — 72 loom cards with status colours."
      />

      <div className="fleet-grid">
        <StatCard label="Running" value={counts.RUNNING} tone="running" />
        <StatCard label="Stopped" value={counts.STOPPED} tone="stopped" />
        <StatCard label="Breakdown" value={counts.BREAKDOWN} tone="breakdown" />
        <StatCard label="Idle / Maint." value={counts.IDLE + counts.MAINTENANCE} />
      </div>

      <div className="filters">
        {(["ALL", "RUNNING", "STOPPED", "BREAKDOWN", "MAINTENANCE", "IDLE"] as const).map(
          (s) => (
            <button
              key={s}
              type="button"
              className={filter === s ? "active" : undefined}
              onClick={() => setFilter(s)}
            >
              {s === "ALL" ? "All" : s.toLowerCase()}
            </button>
          ),
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : (
        <div className="floor-grid">
          {visible.map((loom) => (
            <Link
              key={loom.id}
              to={`/looms/${loom.id}`}
              className={`floor-card status-${loom.status.toLowerCase()}`}
            >
              <div className="floor-card-top">
                <strong>{loom.loom_number.replace(" LOOM ", " ")}</strong>
                <StatusBadge status={loom.status} />
              </div>
              <div className="floor-meta">
                <span>{loom.loom_type}</span>
                <span>{loom.location ?? "—"}</span>
              </div>
              <div className="floor-article">{loom.current_article ?? "No article"}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
