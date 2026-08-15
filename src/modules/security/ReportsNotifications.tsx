import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth";
import {
  getDashboardStats,
  listCeoRequests,
  listIncidents,
  listMaterialEntries,
  listNotifications,
  listVehicles,
  listVisitorEntries,
  listVisitorRequests,
  markNotificationRead,
} from "../../services/securityService";
import type { SecurityNotification } from "../../types/security";
import { EmptyState, LoadingBlock, Toast } from "../../components/ui/primitives";
import { isSupabaseConfigured } from "../../lib/supabase";
import { subscribeStore } from "../../lib/localStore";

export function SecurityReportsPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Record<string, number | string>>({});

  useEffect(() => {
    async function load() {
      try {
        const [stats, visitors, ceo, entries, vehicles, , incidents] =
          await Promise.all([
            getDashboardStats(),
            listVisitorRequests(),
            listCeoRequests(),
            listVisitorEntries(),
            listVehicles(),
            listMaterialEntries(),
            listIncidents(),
          ]);
        const month = new Date().toISOString().slice(0, 7);
        const monthlyVisitors = visitors.filter((v) => v.created_at.startsWith(month)).length;
        setReport({
          "Daily Visitors (today)": stats.totalVisitorsToday,
          "Pending CEO Requests": stats.ceoRequests,
          "Approved Visitors (today)": stats.approved,
          "Rejected Visitors (today)": stats.rejected,
          "Inside Factory": stats.insideFactory,
          "Exited (today)": stats.exited,
          "CEO Meetings (all)": ceo.length,
          "Visitor Duration Samples": entries.filter((e) => e.visit_duration).length,
          "Open Incidents": incidents.filter((i) => i.status !== "CLOSED").length,
          "Vehicles Inside": vehicles.filter((v) => v.status === "INSIDE").length,
          "Material Inward (today)": stats.materialInward,
          "Material Outward (today)": stats.materialOutward,
          "Monthly Visitors": monthlyVisitors,
          "Security Guard Activity (entries today)": stats.gatePassesIssued,
        });
      } finally {
        setLoading(false);
      }
    }
    void load();
    if (!isSupabaseConfigured) return subscribeStore(() => void load());
  }, []);

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Security Reports</h2>
          <p className="subtitle">
            Daily visitor, CEO meeting, incidents, vehicles, material gate and guard activity.
          </p>
        </div>
      </header>
      <section className="panel table-panel">
        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="fleet-grid security-stats">
            {Object.entries(report).map(([label, value]) => (
              <article key={label} className="panel stat">
                <span className="label">{label}</span>
                <div className="value" style={{ fontSize: "1.6rem" }}>
                  {value}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel page-card">
        <h3>Management monthly view</h3>
        <p>
          Monthly visitor statistics update automatically from live visitor_requests. Export detailed
          history from Visitor History (CSV / Excel / PDF).
        </p>
      </section>
    </>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SecurityNotification[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    setRows(await listNotifications(user));
  }

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return subscribeStore(() => void refresh());
  }, [user]);

  const unread = useMemo(() => rows.filter((r) => !r.is_read).length, [rows]);

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Notifications</h2>
          <p className="subtitle">
            In-app alerts for CEO decisions, visitor events and security desk activity. WhatsApp / Email
            channels are modular server-side.
          </p>
        </div>
        <div className="live-chip">{unread} unread</div>
      </header>
      <Toast message={toast} onClose={() => setToast(null)} />
      <section className="panel table-panel">
        {rows.length === 0 ? (
          <EmptyState title="No notifications" />
        ) : (
          <div className="ops-grid">
            {rows.map((n) => (
              <div key={n.id} className={`op-row ${n.is_read ? "" : "unread"}`}>
                <div className="left">
                  <span className={`op-icon ${n.is_read ? "info" : "crit"}`}>
                    {n.is_read ? "RD" : "NW"}
                  </span>
                  <div>
                    <div className="title">{n.message}</div>
                    <div className="hint-line">
                      {n.notification_type} · {new Date(n.created_at).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    className="btn tiny"
                    onClick={() =>
                      void markNotificationRead(n.id).then(() => {
                        setToast("Marked read");
                        void refresh();
                      })
                    }
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function SecuritySettingsPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h2>Security Settings</h2>
          <p className="subtitle">Environment and notification channel configuration.</p>
        </div>
      </header>
      <section className="panel page-card">
        <h3>Runtime</h3>
        <p>
          Mode: <strong>{isSupabaseConfigured ? "Supabase connected" : "Local browser store"}</strong>
        </p>
        <p>
          WhatsApp credentials must be set as <strong>server-side</strong> Edge Function secrets only:
          WHATSAPP_API_URL, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, CEO_WHATSAPP_NUMBER,
          CEO_APPROVAL_TOKEN_SECRET, APP_BASE_URL.
        </p>
        <p>
          Frontend may only use VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Never expose the service
          role key or WhatsApp access token in the browser.
        </p>
      </section>
    </>
  );
}
