import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { decideCeoRequest, listCeoRequests } from "../../services/securityService";
import type { CeoVisitRequest } from "../../types/security";
import { Field, LoadingBlock, StatusBadge, Toast } from "../../components/ui/primitives";
import { useAuth } from "../../lib/auth";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export function CeoApprovalPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loginLocal } = useAuth();
  const token = params.get("token") || undefined;
  const preset = params.get("action") as "APPROVE" | "REJECT" | "RESCHEDULE" | null;
  const local = params.get("local") === "1";

  const [row, setRow] = useState<CeoVisitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [mode, setMode] = useState<"APPROVE" | "REJECT" | "RESCHEDULE" | null>(
    preset === "APPROVE" ? "APPROVE" : preset === "REJECT" ? "REJECT" : preset === "RESCHEDULE" ? "RESCHEDULE" : null
  );
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        if (isSupabaseConfigured && supabase && token) {
          // Public-ish fetch via edge function decision path needs visitor details —
          // use anon select if RLS allows CEO/token path; fallback list for local.
          const { data } = await supabase
            .from("ceo_visit_requests")
            .select("*, visitor:visitor_requests(*)")
            .eq("id", id)
            .maybeSingle();
          if (data) {
            setRow(data as CeoVisitRequest);
            setNewDate((data as CeoVisitRequest).visitor?.requested_date || "");
            setNewTime((data as CeoVisitRequest).visitor?.requested_time || "");
          } else {
            // Token-only users may not have SELECT; show minimal from query params context
            setError(null);
            setRow({
              id,
              visitor_request_id: "",
              request_number: "…",
              status: "PENDING_CEO_APPROVAL",
              ceo_decision: null,
              ceo_remarks: null,
              decision_by: null,
              decision_at: null,
              rescheduled_date: null,
              rescheduled_time: null,
              approval_token_hash: null,
              token_expires_at: null,
              whatsapp_status: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        } else {
          const all = await listCeoRequests();
          const found = all.find((c) => c.id === id) || null;
          if (!found) setError("Request not found");
          else {
            setRow(found);
            setNewDate(found.visitor?.requested_date || "");
            setNewTime(found.visitor?.requested_time || "");
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, token]);

  useEffect(() => {
    if (local && !user) {
      loginLocal("CEO");
    }
  }, [local, user, loginLocal]);

  async function submit(decision: "APPROVED" | "REJECTED" | "RESCHEDULED") {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase && token) {
        const { data, error: fnErr } = await supabase.functions.invoke("ceo-decision", {
          body: {
            ceo_request_id: id,
            decision,
            remarks,
            rescheduled_date: decision === "RESCHEDULED" ? newDate : undefined,
            rescheduled_time: decision === "RESCHEDULED" ? newTime : undefined,
            token,
          },
        });
        if (fnErr) throw fnErr;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      } else {
        if (!user) throw new Error("Please sign in as CEO");
        await decideCeoRequest({
          ceoRequestId: id,
          decision,
          remarks,
          rescheduled_date: decision === "RESCHEDULED" ? newDate : undefined,
          rescheduled_time: decision === "RESCHEDULED" ? newTime : undefined,
          decisionBy: user,
          token,
        });
      }
      setDone(true);
      setToast(`Decision saved: ${decision}`);
      setRow((r) => (r ? { ...r, ceo_decision: decision, status: decision } : r));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="ceo-mobile"><LoadingBlock label="Loading visiting request…" /></div>;

  return (
    <div className="ceo-mobile">
      <div className="ceo-card">
        <div className="gp-brand">OPA GROUP OF INDIA</div>
        <h1>Visiting Request</h1>
        <Toast message={toast} onClose={() => setToast(null)} />
        {error && <div className="banner error">{error}</div>}

        {row && (
          <>
            <div className="detail-grid">
              <div><span>Request</span><strong>{row.request_number}</strong></div>
              <div><span>Visitor</span><strong>{row.visitor?.visitor_name || "—"}</strong></div>
              <div><span>Company</span><strong>{row.visitor?.company_name || "—"}</strong></div>
              <div><span>Mobile</span><strong>{row.visitor?.mobile || "—"}</strong></div>
              <div><span>Purpose</span><strong>{row.visitor?.purpose || "—"}</strong></div>
              <div><span>Date</span><strong>{row.visitor?.requested_date || "—"}</strong></div>
              <div><span>Time</span><strong>{row.visitor?.requested_time || "—"}</strong></div>
              <div><span>Visitors</span><strong>{row.visitor?.number_of_visitors ?? "—"}</strong></div>
              <div><span>Security remarks</span><strong>{row.visitor?.security_remarks || "—"}</strong></div>
              <div>
                <span>Status</span>
                <strong>
                  <StatusBadge status={row.ceo_decision || row.status} />
                </strong>
              </div>
            </div>

            {!done && !row.ceo_decision && (
              <>
                <div className="ceo-actions">
                  <button type="button" className="btn primary block" onClick={() => setMode("APPROVE")}>
                    Approve
                  </button>
                  <button type="button" className="btn danger block" onClick={() => setMode("REJECT")}>
                    Reject
                  </button>
                  <button type="button" className="btn block" onClick={() => setMode("RESCHEDULE")}>
                    Reschedule
                  </button>
                </div>

                {mode && (
                  <div className="ceo-decision-box">
                    {mode === "RESCHEDULE" && (
                      <div className="form-grid two">
                        <Field label="New Date" required>
                          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                        </Field>
                        <Field label="New Time" required>
                          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                        </Field>
                      </div>
                    )}
                    {(mode === "REJECT" || mode === "RESCHEDULE") && (
                      <Field label="CEO Remarks" required>
                        <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                      </Field>
                    )}
                    {mode === "APPROVE" && (
                      <Field label="CEO Remarks (optional)">
                        <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                      </Field>
                    )}
                    <button
                      type="button"
                      className={`btn block ${mode === "REJECT" ? "danger" : "primary"}`}
                      disabled={saving}
                      onClick={() =>
                        void submit(
                          mode === "APPROVE" ? "APPROVED" : mode === "REJECT" ? "REJECTED" : "RESCHEDULED"
                        )
                      }
                    >
                      {saving ? "Saving…" : `Confirm ${mode}`}
                    </button>
                  </div>
                )}
              </>
            )}

            {(done || row.ceo_decision) && (
              <p className="ceo-done">
                Decision recorded. Security will see the updated status immediately.
              </p>
            )}
          </>
        )}

        <button type="button" className="btn ghost block" onClick={() => navigate("/")}>
          Back to ERP
        </button>
      </div>
    </div>
  );
}
