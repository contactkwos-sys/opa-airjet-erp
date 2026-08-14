import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { hasPermission } from "../../lib/roles";
import {
  closeIncident,
  createIncident,
  createMaterialEntry,
  createVehicleEntry,
  exitVehicle,
  listIncidents,
  listMaterialEntries,
  listVehicles,
} from "../../services/securityService";
import type {
  IncidentType,
  MaterialGateEntry,
  SecurityIncident,
  Severity,
  VehicleEntry,
} from "../../types/security";
import { INCIDENT_TYPES, SEVERITIES } from "../../types/security";
import {
  EmptyState,
  Field,
  LoadingBlock,
  StatusBadge,
  Toast,
} from "../../components/ui/primitives";
import { isSupabaseConfigured } from "../../lib/supabase";
import { nowISO, subscribeStore, todayISO } from "../../lib/localStore";

export function VehicleManagementPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VehicleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    vehicle_number: "",
    driver_name: "",
    mobile: "",
    company: "",
    purpose: "",
    material: "",
    direction: "IN" as "IN" | "OUT",
    gate_pass_number: "",
  });
  const can = user && hasPermission(user.role, "security.vehicle");

  async function refresh() {
    try {
      setRows(await listVehicles());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return subscribeStore(() => void refresh());
  }, []);

  async function save() {
    if (!user) return;
    try {
      await createVehicleEntry(
        {
          ...form,
          entry_time: nowISO(),
          security_officer: user.full_name,
          gate_pass_number: form.gate_pass_number || null,
          mobile: form.mobile || null,
          company: form.company || null,
          purpose: form.purpose || null,
          material: form.material || null,
        },
        user
      );
      setToast("Vehicle entry saved");
      setForm({
        vehicle_number: "",
        driver_name: "",
        mobile: "",
        company: "",
        purpose: "",
        material: "",
        direction: "IN",
        gate_pass_number: "",
      });
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Vehicle Management</h2>
          <p className="subtitle">Gate vehicle entry and exit.</p>
        </div>
      </header>
      <Toast message={toast} onClose={() => setToast(null)} />
      {can && (
        <section className="panel form-panel">
          <div className="form-grid">
            <Field label="Vehicle Number" required>
              <input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
            </Field>
            <Field label="Driver Name" required>
              <input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label="Company">
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
            <Field label="Purpose">
              <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
            </Field>
            <Field label="Material">
              <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
            </Field>
            <Field label="In/Out">
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as "IN" | "OUT" })}>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </Field>
            <Field label="Gate Pass">
              <input value={form.gate_pass_number} onChange={(e) => setForm({ ...form, gate_pass_number: e.target.value })} />
            </Field>
          </div>
          <button type="button" className="btn primary" onClick={() => void save()}>
            Save Vehicle Entry
          </button>
        </section>
      )}
      <section className="panel table-panel">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No vehicle movements" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Mobile</th>
                  <th>Company</th>
                  <th>Purpose</th>
                  <th>Dir</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.vehicle_number}</td>
                    <td>{r.driver_name}</td>
                    <td>{r.mobile}</td>
                    <td>{r.company}</td>
                    <td>{r.purpose}</td>
                    <td>{r.direction}</td>
                    <td>{new Date(r.entry_time).toLocaleString("en-IN")}</td>
                    <td>{r.exit_time ? new Date(r.exit_time).toLocaleString("en-IN") : "—"}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      {can && r.status === "INSIDE" && user && (
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => void exitVehicle(r.id, user).then(refresh)}
                        >
                          Exit
                        </button>
                      )}
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

export function MaterialGatePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MaterialGateEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<"INWARD" | "OUTWARD">("INWARD");
  const [form, setForm] = useState({
    supplier_or_department: "",
    po_number: "",
    invoice_number: "",
    challan_number: "",
    vehicle_number: "",
    material: "",
    quantity: 1,
    unit: "NOS",
    purpose: "",
    approved_by: "",
    document_url: "",
    photo_url: "",
  });
  const can = user && hasPermission(user.role, "security.material");

  async function refresh() {
    setRows(await listMaterialEntries());
  }

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return subscribeStore(() => void refresh());
  }, []);

  async function save() {
    if (!user) return;
    try {
      await createMaterialEntry(
        {
          entry_type: tab,
          supplier_or_department: form.supplier_or_department,
          po_number: form.po_number || null,
          invoice_number: form.invoice_number || null,
          challan_number: form.challan_number || null,
          vehicle_number: form.vehicle_number || null,
          material: form.material,
          quantity: form.quantity,
          unit: form.unit,
          purpose: form.purpose || null,
          approved_by: form.approved_by || null,
          security_verified_by: user.full_name,
          entry_time: nowISO(),
          exit_time: null,
          document_url: form.document_url || null,
          photo_url: form.photo_url || null,
          status: "VERIFIED",
        },
        user
      );
      setToast(tab === "INWARD" ? "Material inward recorded" : "Material outward recorded");
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Material Gate</h2>
          <p className="subtitle">Inward and outward material gate security. Outward requires approval.</p>
        </div>
      </header>
      <Toast message={toast} onClose={() => setToast(null)} />
      <div className="filters" role="tablist">
        <button type="button" className={tab === "INWARD" ? "active" : undefined} onClick={() => setTab("INWARD")}>
          Material Inward
        </button>
        <button type="button" className={tab === "OUTWARD" ? "active" : undefined} onClick={() => setTab("OUTWARD")}>
          Material Outward
        </button>
      </div>
      {can && (
        <section className="panel form-panel">
          <div className="form-grid">
            <Field label={tab === "INWARD" ? "Supplier" : "Department"} required>
              <input
                value={form.supplier_or_department}
                onChange={(e) => setForm({ ...form, supplier_or_department: e.target.value })}
              />
            </Field>
            {tab === "INWARD" ? (
              <>
                <Field label="PO Number">
                  <input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
                </Field>
                <Field label="Invoice Number">
                  <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Challan Number">
                  <input value={form.challan_number} onChange={(e) => setForm({ ...form, challan_number: e.target.value })} />
                </Field>
                <Field label="Approved By" required>
                  <input value={form.approved_by} onChange={(e) => setForm({ ...form, approved_by: e.target.value })} />
                </Field>
                <Field label="Purpose">
                  <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Vehicle Number">
              <input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
            </Field>
            <Field label="Material" required>
              <input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
            </Field>
            <Field label="Quantity" required>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </Field>
            <Field label="Unit">
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
            <Field label="Photo URL">
              <input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            </Field>
            <Field label="Document URL">
              <input value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} />
            </Field>
          </div>
          <button type="button" className="btn primary" onClick={() => void save()}>
            Save {tab === "INWARD" ? "Inward" : "Outward"}
          </button>
        </section>
      )}
      <section className="panel table-panel">
        {rows.length === 0 ? (
          <EmptyState title="No material gate entries" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Supplier/Dept</th>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Vehicle</th>
                  <th>Approved By</th>
                  <th>Verified By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.entry_type}</td>
                    <td>{r.supplier_or_department}</td>
                    <td>{r.material}</td>
                    <td>
                      {r.quantity} {r.unit}
                    </td>
                    <td>{r.vehicle_number}</td>
                    <td>{r.approved_by || "—"}</td>
                    <td>{r.security_verified_by}</td>
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

export function SecurityIncidentsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<SecurityIncident[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    incident_date: todayISO(),
    incident_time: "09:00",
    location: "",
    incident_type: "Unauthorized Entry" as IncidentType,
    description: "",
    person_involved: "",
    severity: "MEDIUM" as Severity,
    action_taken: "",
    photo_url: "",
    attachment_url: "",
  });
  const can = user && hasPermission(user.role, "security.incident");

  async function refresh() {
    setRows(await listIncidents());
  }

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return subscribeStore(() => void refresh());
  }, []);

  async function save() {
    if (!user) return;
    try {
      await createIncident(
        {
          ...form,
          person_involved: form.person_involved || null,
          security_officer: user.full_name,
          action_taken: form.action_taken || null,
          photo_url: form.photo_url || null,
          attachment_url: form.attachment_url || null,
          status: "OPEN",
        },
        user
      );
      setToast("Incident logged");
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Security Incidents</h2>
          <p className="subtitle">Log, track and close security incidents.</p>
        </div>
      </header>
      <Toast message={toast} onClose={() => setToast(null)} />
      {can && (
        <section className="panel form-panel">
          <div className="form-grid">
            <Field label="Date" required>
              <input type="date" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
            </Field>
            <Field label="Time" required>
              <input type="time" value={form.incident_time} onChange={(e) => setForm({ ...form, incident_time: e.target.value })} />
            </Field>
            <Field label="Location" required>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="Incident Type" required>
              <select
                value={form.incident_type}
                onChange={(e) => setForm({ ...form, incident_type: e.target.value as IncidentType })}
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Severity" required>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Person Involved">
              <input value={form.person_involved} onChange={(e) => setForm({ ...form, person_involved: e.target.value })} />
            </Field>
            <Field label="Description" required>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Action Taken">
              <textarea rows={2} value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} />
            </Field>
            <Field label="Photo URL">
              <input value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            </Field>
            <Field label="Attachment URL">
              <input value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} />
            </Field>
          </div>
          <button type="button" className="btn primary" onClick={() => void save()}>
            Create Incident
          </button>
        </section>
      )}
      <section className="panel table-panel">
        {rows.length === 0 ? (
          <EmptyState title="No incidents" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Officer</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.incident_number}</td>
                    <td>
                      {r.incident_date} {r.incident_time}
                    </td>
                    <td>{r.location}</td>
                    <td>{r.incident_type}</td>
                    <td>
                      <StatusBadge status={r.severity} />
                    </td>
                    <td>{r.security_officer}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      {can && r.status !== "CLOSED" && user && (
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => void closeIncident(r.id, user).then(refresh)}
                        >
                          Close
                        </button>
                      )}
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
