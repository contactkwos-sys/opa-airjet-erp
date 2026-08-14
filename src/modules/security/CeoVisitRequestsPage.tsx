import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { hasPermission } from "../../lib/roles";
import { decideCeoRequest, getLocalCeoApprovalPath, listCeoRequests } from "../../services/securityService";
import type { CeoVisitRequest } from "../../types/security";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  StatusBadge,
  Toast,
} from "../../components/ui/primitives";
import { isSupabaseConfigured } from "../../lib/supabase";
import { subscribeStore } from "../../lib/localStore";

export function CeoVisitRequestsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CeoVisitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<CeoVisitRequest | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "RESCHEDULED" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canDecide = user && hasPermission(user.role, "ceo.requests.decide");

  async function refresh() {
    try {
      setRows(await listCeoRequests());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return subscribeStore(() => void refresh());
    return undefined;
  }, []);

  function openDecision(row: CeoVisitRequest, d: "APPROVED" | "REJECTED" | "RESCHEDULED") {
    setSelected(row);
    setDecision(d);
    setRemarks("");
    setNewDate(row.visitor?.requested_date || "");
    setNewTime(row.visitor?.requested_time || "");
    setConfirmOpen(true);
  }

  async function applyDecision() {
    if (!user || !selected || !decision) return;
    setSaving(true);
    try {
      await decideCeoRequest({
        ceoRequestId: selected.id,
        decision,
        remarks,
        rescheduled_date: decision === "RESCHEDULED" ? newDate : undefined,
        rescheduled_time: decision === "RESCHEDULED" ? newTime : undefined,
        decisionBy: user,
      });
      setToast(`Request ${selected.request_number} marked ${decision}`);
      setConfirmOpen(false);
      setSelected(null);
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h2>CEO Visiting Requests</h2>
          <p className="subtitle">Approve, reject or reschedule CEO meeting requests.</p>
        </div>
      </header>
      <Toast message={toast} tone="info" onClose={() => setToast(null)} />

      <section className="panel table-panel">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No CEO visiting requests" hint="Use Request Meeting with CEO from Visitor Requests." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Visitor</th>
                  <th>Company</th>
                  <th>Mobile</th>
                  <th>Purpose</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Security User</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>CEO Decision</th>
                  <th>CEO Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.request_number}</td>
                    <td>{r.visitor?.visitor_name}</td>
                    <td>{r.visitor?.company_name}</td>
                    <td>{r.visitor?.mobile}</td>
                    <td>{r.visitor?.purpose}</td>
                    <td>{r.visitor?.requested_date}</td>
                    <td>{r.visitor?.requested_time}</td>
                    <td>{r.visitor?.created_by_name || "—"}</td>
                    <td>{new Date(r.created_at).toLocaleString("en-IN")}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{r.ceo_decision ? <StatusBadge status={r.ceo_decision} /> : "—"}</td>
                    <td>{r.ceo_remarks || "—"}</td>
                    <td>
                      <div className="btn-row compact">
                        {!r.ceo_decision && canDecide && (
                          <>
                            <button type="button" className="btn tiny primary" onClick={() => openDecision(r, "APPROVED")}>
                              Approve
                            </button>
                            <button type="button" className="btn tiny danger" onClick={() => openDecision(r, "REJECTED")}>
                              Reject
                            </button>
                            <button type="button" className="btn tiny" onClick={() => openDecision(r, "RESCHEDULED")}>
                              Reschedule
                            </button>
                          </>
                        )}
                        {!isSupabaseConfigured && !r.ceo_decision && (
                          <Link className="btn tiny ghost" to={getLocalCeoApprovalPath(r.id)}>
                            Mobile link
                          </Link>
                        )}
                        {r.whatsapp_status === "PENDING_CONFIGURATION" && (
                          <span className="mini-chip warn">WhatsApp Pending Configuration</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen && decision === "APPROVED"}
        title="Approve CEO visiting request?"
        message={`Approve ${selected?.request_number}? This cannot be reversed.`}
        confirmLabel={saving ? "Saving…" : "Approve"}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void applyDecision()}
      />

      <Modal
        open={confirmOpen && (decision === "REJECTED" || decision === "RESCHEDULED")}
        title={decision === "REJECTED" ? "Reject visiting request" : "Reschedule visiting request"}
        onClose={() => setConfirmOpen(false)}
      >
        {decision === "RESCHEDULED" && (
          <div className="form-grid two">
            <Field label="New Date" required>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </Field>
            <Field label="New Time" required>
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="CEO Remarks" required>
          <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${decision === "REJECTED" ? "danger" : "primary"}`}
            disabled={saving}
            onClick={() => void applyDecision()}
          >
            {saving ? "Saving…" : decision}
          </button>
        </div>
      </Modal>
    </>
  );
}
