import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { hasPermission } from "../../lib/roles";
import { validateVisitorForm } from "../../lib/validators";
import {
  createVisitorRequest,
  getLocalCeoApprovalPath,
  listVisitorRequests,
} from "../../services/securityService";
import type { PersonToMeet, VisitorRequest } from "../../types/security";
import { PERSON_TO_MEET_OPTIONS } from "../../types/security";
import {
  EmptyState,
  Field,
  LoadingBlock,
  StatusBadge,
  Toast,
} from "../../components/ui/primitives";
import { subscribeStore } from "../../lib/localStore";
import { isSupabaseConfigured } from "../../lib/supabase";
import { todayISO } from "../../lib/localStore";

const emptyForm = {
  visitor_name: "",
  company_name: "",
  mobile: "",
  email: "",
  purpose: "",
  person_to_meet: "GENERAL MANAGER" as PersonToMeet,
  department: "",
  requested_date: todayISO(),
  requested_time: "10:00",
  number_of_visitors: 1,
  vehicle_number: "",
  vehicle_type: "",
  id_proof_type: "Aadhaar",
  id_proof_number: "",
  visitor_photo_url: "",
  security_remarks: "",
};

export function VisitorRequestsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VisitorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "warn" | "error" | "info">("success");

  const canCreate = user && hasPermission(user.role, "security.visitor.create");

  async function refresh() {
    try {
      setRows(await listVisitorRequests());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return subscribeStore(() => void refresh());
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(requestCeoMeeting: boolean) {
    if (!user || !canCreate) return;
    const payload = {
      ...form,
      person_to_meet: requestCeoMeeting ? ("CEO" as PersonToMeet) : form.person_to_meet,
      requestCeoMeeting,
    };
    const errs = validateVisitorForm(payload);
    setErrors(errs);
    if (errs.length) return;

    setSaving(true);
    try {
      const result = await createVisitorRequest(payload, user);
      let msg = `Saved ${result.visitor.request_number}`;
      if (result.ceo) {
        msg += ` · CEO request created`;
        if (result.whatsappStatus === "PENDING_CONFIGURATION") {
          msg += " · WhatsApp Pending Configuration";
          setToastTone("warn");
        } else if (result.whatsappStatus === "SENT") {
          msg += " · WhatsApp sent to CEO";
          setToastTone("success");
        } else if (result.whatsappStatus === "FAILED") {
          msg += " · WhatsApp failed (request saved)";
          setToastTone("warn");
        } else {
          setToastTone("success");
        }
        if (!isSupabaseConfigured) {
          msg += ` · Local CEO link: ${getLocalCeoApprovalPath(result.ceo.id)}`;
        }
      } else {
        setToastTone("success");
      }
      setToast(msg);
      setForm({ ...emptyForm, requested_date: todayISO() });
      await refresh();
    } catch (e) {
      setToastTone("error");
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Visitor Requests</h2>
          <p className="subtitle">Create visiting requests and escalate CEO meetings.</p>
        </div>
      </header>

      <Toast message={toast} tone={toastTone} onClose={() => setToast(null)} />

      {canCreate && (
        <section className="panel form-panel">
          <div className="section-head">
            <h3>New Visiting Request</h3>
            <span>Security desk form</span>
          </div>
          {errors.length > 0 && (
            <div className="banner error">
              {errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          )}
          <div className="form-grid">
            <Field label="Visitor Name" required>
              <input value={form.visitor_name} onChange={(e) => set("visitor_name", e.target.value)} />
            </Field>
            <Field label="Company Name" required>
              <input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </Field>
            <Field label="Mobile Number" required>
              <input
                value={form.mobile}
                onChange={(e) => set("mobile", e.target.value)}
                placeholder="10-digit Indian mobile"
              />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Purpose of Visit" required>
              <input value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
            </Field>
            <Field label="Person To Meet" required>
              <select
                value={form.person_to_meet}
                onChange={(e) => set("person_to_meet", e.target.value as PersonToMeet)}
              >
                {PERSON_TO_MEET_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <input value={form.department} onChange={(e) => set("department", e.target.value)} />
            </Field>
            <Field label="Requested Date" required>
              <input
                type="date"
                value={form.requested_date}
                onChange={(e) => set("requested_date", e.target.value)}
              />
            </Field>
            <Field label="Requested Time" required>
              <input
                type="time"
                value={form.requested_time}
                onChange={(e) => set("requested_time", e.target.value)}
              />
            </Field>
            <Field label="Number of Visitors" required>
              <input
                type="number"
                min={1}
                max={50}
                value={form.number_of_visitors}
                onChange={(e) => set("number_of_visitors", Number(e.target.value))}
              />
            </Field>
            <Field label="Vehicle Number">
              <input value={form.vehicle_number} onChange={(e) => set("vehicle_number", e.target.value)} />
            </Field>
            <Field label="Vehicle Type">
              <input value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} />
            </Field>
            <Field label="ID Proof Type">
              <select value={form.id_proof_type} onChange={(e) => set("id_proof_type", e.target.value)}>
                <option>Aadhaar</option>
                <option>PAN</option>
                <option>Driving License</option>
                <option>Voter ID</option>
                <option>Passport</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="ID Proof Number">
              <input value={form.id_proof_number} onChange={(e) => set("id_proof_number", e.target.value)} />
            </Field>
            <Field label="Visitor Photo URL">
              <input
                value={form.visitor_photo_url}
                onChange={(e) => set("visitor_photo_url", e.target.value)}
                placeholder="Optional image URL / storage path"
              />
            </Field>
            <Field label="Additional Remarks">
              <textarea
                value={form.security_remarks}
                onChange={(e) => set("security_remarks", e.target.value)}
                rows={2}
              />
            </Field>
          </div>
          <div className="btn-row wrap">
            <button type="button" className="btn primary" disabled={saving} onClick={() => void submit(false)}>
              {saving ? "Saving…" : "Save Visiting Request"}
            </button>
            <button
              type="button"
              className="btn ceo"
              disabled={saving}
              onClick={() => void submit(true)}
            >
              Request Meeting with CEO
            </button>
          </div>
        </section>
      )}

      <section className="panel table-panel">
        <div className="section-head">
          <h3>All requests</h3>
          <span>{rows.length} records</span>
        </div>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No visitor requests yet" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Visitor</th>
                  <th>Company</th>
                  <th>Mobile</th>
                  <th>Meet</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.request_number}</td>
                    <td>{r.visitor_name}</td>
                    <td>{r.company_name}</td>
                    <td>{r.mobile}</td>
                    <td>{r.person_to_meet}</td>
                    <td>{r.requested_date}</td>
                    <td>{r.requested_time}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
