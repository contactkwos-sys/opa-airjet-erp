import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import type { OpaCeoVisitRequest } from "@/types/database";
import { TextInput, TextTextarea, LoadingState, AlertBanner } from "@/components/ui";

type Action = "approve" | "reject" | "reschedule";

export default function CeoVisitMobilePage() {
  const { token } = useParams();
  const [request, setRequest] = useState<OpaCeoVisitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sb = getSupabase();
      if (!sb || !token) {
        if (!cancelled) {
          setRequest({
            id: "demo",
            request_number: "CEO-DEMO-001",
            visitor_name: "Demo Visitor",
            visitor_mobile: "9876543210",
            visitor_company: "Partner Mills",
            purpose: "Plant walkthrough with production head",
            proposed_visit_at: new Date(Date.now() + 86400000).toISOString(),
            status: "PENDING",
            action_token: token ?? "demo",
            action_token_expires_at: null,
            ceo_notes: null,
            approved_visit_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          setLoading(false);
        }
        return;
      }
      try {
        const { data, error: err } = await sb
          .from("opa_ceo_visit_requests")
          .select("*")
          .eq("action_token", token)
          .maybeSingle();
        if (err) throw err;
        if (!cancelled) {
          if (!data) setError("This visit link is invalid or expired.");
          else setRequest(data as OpaCeoVisitRequest);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load visit");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function act(action: Action) {
    if (!request) return;
    setBusy(true);
    setError(null);
    const sb = getSupabase();
    if (!sb || request.id === "demo") {
      setMessage(
        action === "approve"
          ? "Visit approved (demo)."
          : action === "reject"
            ? "Visit rejected (demo)."
            : "Reschedule requested (demo).",
      );
      setRequest({
        ...request,
        status:
          action === "approve"
            ? "APPROVED"
            : action === "reject"
              ? "REJECTED"
              : "RESCHEDULED",
        ceo_notes: notes || request.ceo_notes,
        approved_visit_at: action === "approve" ? visitAt || request.proposed_visit_at : null,
      });
      setBusy(false);
      return;
    }

    const status =
      action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "RESCHEDULED";
    try {
      const { error: err } = await sb
        .from("opa_ceo_visit_requests")
        .update({
          status,
          ceo_notes: notes || null,
          ceo_response_at: new Date().toISOString(),
          approved_visit_at:
            action === "approve" ? visitAt || request.proposed_visit_at : null,
        } as never)
        .eq("id", request.id)
        .eq("action_token", token!);
      if (err) throw err;
      setMessage(`Visit ${status.toLowerCase()}.`);
      setRequest({ ...request, status, ceo_notes: notes || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="ceo-mobile">
        <LoadingState label="Loading visit request…" />
      </div>
    );
  }

  return (
    <div className="ceo-mobile">
      <div className="ceo-card panel">
        <div className="brand login-brand">
          <div className="brand-mark">OPA</div>
          <h1>CEO Visit</h1>
          <p>Approve · Reject · Reschedule</p>
        </div>

        {error ? <AlertBanner tone="danger" title="Error" children={error} /> : null}
        {message ? <AlertBanner tone="success" title="Done" children={message} /> : null}

        {request ? (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Request</dt>
                <dd>{request.request_number}</dd>
              </div>
              <div>
                <dt>Visitor</dt>
                <dd>{request.visitor_name}</dd>
              </div>
              <div>
                <dt>Company</dt>
                <dd>{request.visitor_company ?? "—"}</dd>
              </div>
              <div>
                <dt>Purpose</dt>
                <dd>{request.purpose}</dd>
              </div>
              <div>
                <dt>Proposed</dt>
                <dd>
                  {request.proposed_visit_at
                    ? new Date(request.proposed_visit_at).toLocaleString("en-IN")
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{request.status}</dd>
              </div>
            </dl>

            {request.status === "PENDING" ? (
              <div className="form-grid">
                <TextInput
                  label="Approved visit time"
                  type="datetime-local"
                  value={visitAt}
                  onChange={(e) => setVisitAt(e.target.value)}
                />
                <TextTextarea
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="ceo-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void act("approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={() => void act("reject")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => void act("reschedule")}
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
