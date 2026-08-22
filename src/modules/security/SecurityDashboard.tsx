import { useDashboardStats } from "../../hooks/useSecurityData";
import { LoadingBlock, EmptyState } from "../../components/ui/primitives";
import { isSupabaseConfigured } from "../../lib/supabase";

const CARDS: { key: keyof NonNullable<ReturnType<typeof useDashboardStats>["stats"]>; label: string; tone?: string }[] = [
  { key: "totalVisitorsToday", label: "Total Visitors Today" },
  { key: "pendingRequests", label: "Pending Requests", tone: "amber" },
  { key: "ceoRequests", label: "CEO Requests", tone: "sky" },
  { key: "approved", label: "Approved", tone: "running" },
  { key: "insideFactory", label: "Inside Factory", tone: "teal" },
  { key: "exited", label: "Exited" },
  { key: "vehicles", label: "Vehicles", tone: "sky" },
  { key: "securityAlerts", label: "Security Alerts", tone: "breakdown" },
];

export function SecurityDashboard({
  onNavigate,
}: {
  onNavigate: (id: string) => void;
}) {
  const { stats, loading, error } = useDashboardStats();

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Security Dashboard</h2>
          <p className="subtitle">
            Gate, visitors, CEO meeting requests, vehicles and incidents — live
            {isSupabaseConfigured ? " from live database" : " — database not configured"}.
          </p>
        </div>
      </header>

      {!isSupabaseConfigured && (
        <div className="banner warn">
          Supabase env vars are not set. Data is stored locally in this browser so workflows can be tested.
          Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> for production.
        </div>
      )}

      {error && <div className="banner error">{error}</div>}
      {loading && !stats ? <LoadingBlock /> : null}

      {stats && (
        <>
          <div className="fleet-grid security-stats">
            {CARDS.map((c) => (
              <article key={c.key} className={`panel stat ${c.tone ?? ""}`}>
                <span className="label">{c.label}</span>
                <div className="value">{stats[c.key]}</div>
              </article>
            ))}
          </div>

          <div className="production-layout">
            <section className="panel ops-panel">
              <div className="section-head">
                <h3>Today at a glance</h3>
                <span>Operational counters</span>
              </div>
              <div className="ops-grid">
                <div className="op-row">
                  <div className="left"><span className="op-icon info">IN</span><span className="title">Material Inward</span></div>
                  <span className="count">{stats.materialInward}</span>
                </div>
                <div className="op-row">
                  <div className="left"><span className="op-icon teal">OUT</span><span className="title">Material Outward</span></div>
                  <span className="count">{stats.materialOutward}</span>
                </div>
                <div className="op-row">
                  <div className="left"><span className="op-icon warn">GP</span><span className="title">Gate Passes Issued</span></div>
                  <span className="count">{stats.gatePassesIssued}</span>
                </div>
                <div className="op-row">
                  <div className="left"><span className="op-icon crit">SI</span><span className="title">Open Incidents</span></div>
                  <span className="count">{stats.securityIncidents}</span>
                </div>
                <div className="op-row">
                  <div className="left"><span className="op-icon crit">EM</span><span className="title">Emergency Alerts</span></div>
                  <span className="count">{stats.emergencyAlerts}</span>
                </div>
                <div className="op-row">
                  <div className="left"><span className="op-icon info">RJ</span><span className="title">Rejected Visitors</span></div>
                  <span className="count">{stats.rejected}</span>
                </div>
              </div>
            </section>

            <section className="panel ops-panel">
              <div className="section-head">
                <h3>Quick actions</h3>
                <span>Security desk</span>
              </div>
              <div className="quick-actions">
                <button type="button" className="btn primary" onClick={() => onNavigate("visitor-requests")}>
                  New Visiting Request
                </button>
                <button type="button" className="btn" onClick={() => onNavigate("ceo-requests")}>
                  CEO Visiting Requests
                </button>
                <button type="button" className="btn" onClick={() => onNavigate("visitors-inside")}>
                  Visitors Inside
                </button>
                <button type="button" className="btn" onClick={() => onNavigate("gate-pass")}>
                  Check-in / Gate Pass
                </button>
                <button type="button" className="btn" onClick={() => onNavigate("incidents")}>
                  Log Incident
                </button>
                <button type="button" className="btn" onClick={() => onNavigate("reports")}>
                  Reports
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      {!loading && !stats && !error && (
        <EmptyState title="No security data" hint="Create a visitor request to begin." />
      )}
    </>
  );
}
