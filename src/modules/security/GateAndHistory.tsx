import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { hasPermission } from "../../lib/roles";
import {
  checkInVisitor,
  checkOutVisitor,
  listInsideVisitors,
  listVisitorEntries,
  listVisitorRequests,
  searchApprovedVisitor,
} from "../../services/securityService";
import type { VisitorEntry, VisitorRequest } from "../../types/security";
import {
  EmptyState,
  Field,
  LoadingBlock,
  Modal,
  StatusBadge,
  Toast,
} from "../../components/ui/primitives";
import { isSupabaseConfigured } from "../../lib/supabase";
import { subscribeStore } from "../../lib/localStore";

export function GatePassPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<VisitorRequest[]>([]);
  const [selected, setSelected] = useState<VisitorRequest | null>(null);
  const [idVerified, setIdVerified] = useState(false);
  const [persons, setPersons] = useState(1);
  const [vehicle, setVehicle] = useState("");
  const [photo, setPhoto] = useState("");
  const [remarks, setRemarks] = useState("");
  const [pass, setPass] = useState<VisitorEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCheckIn = user && hasPermission(user.role, "security.visitor.checkin");

  async function search() {
    if (!query.trim()) return;
    setMatches(await searchApprovedVisitor(query));
  }

  async function doCheckIn() {
    if (!user || !selected) return;
    setSaving(true);
    try {
      const entry = await checkInVisitor({
        visitorRequestId: selected.id,
        user,
        id_verified: idVerified,
        number_of_persons: persons,
        actual_vehicle_number: vehicle || undefined,
        visitor_photo_url: photo || undefined,
        remarks: remarks || undefined,
      });
      setPass(entry);
      setToast(`Checked in · Gate Pass ${entry.gate_pass_number}`);
      setSelected(null);
      setMatches([]);
      setQuery("");
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
          <h2>Gate Pass / Check-in</h2>
          <p className="subtitle">Search approved visitors, verify ID, check in and issue gate pass.</p>
        </div>
      </header>
      <Toast message={toast} onClose={() => setToast(null)} />

      {canCheckIn && (
        <section className="panel form-panel">
          <div className="section-head">
            <h3>Find approved visitor</h3>
            <span>Request ID / Mobile / Name</span>
          </div>
          <div className="btn-row wrap">
            <input
              className="grow"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. VR-20260814-0001 or mobile"
            />
            <button type="button" className="btn primary" onClick={() => void search()}>
              Search
            </button>
          </div>
          {matches.length > 0 && (
            <div className="table-wrap" style={{ marginTop: "1rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Visitor</th>
                    <th>Company</th>
                    <th>Mobile</th>
                    <th>Meet</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id}>
                      <td>{m.request_number}</td>
                      <td>{m.visitor_name}</td>
                      <td>{m.company_name}</td>
                      <td>{m.mobile}</td>
                      <td>{m.person_to_meet}</td>
                      <td>
                        <StatusBadge status={m.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn tiny"
                          onClick={() => {
                            setSelected(m);
                            setPersons(m.number_of_visitors);
                            setVehicle(m.vehicle_number || "");
                            setPhoto(m.visitor_photo_url || "");
                            setIdVerified(false);
                          }}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal open={Boolean(selected)} title="Visitor arrival" onClose={() => setSelected(null)} wide>
        {selected && (
          <>
            <div className="detail-grid">
              <div><span>Visitor</span><strong>{selected.visitor_name}</strong></div>
              <div><span>Company</span><strong>{selected.company_name}</strong></div>
              <div><span>Mobile</span><strong>{selected.mobile}</strong></div>
              <div><span>Meet</span><strong>{selected.person_to_meet}</strong></div>
              <div><span>Purpose</span><strong>{selected.purpose}</strong></div>
              <div><span>Scheduled</span><strong>{selected.requested_date} {selected.requested_time}</strong></div>
            </div>
            <div className="form-grid two" style={{ marginTop: "1rem" }}>
              <Field label="Number of persons" required>
                <input type="number" min={1} value={persons} onChange={(e) => setPersons(Number(e.target.value))} />
              </Field>
              <Field label="Vehicle number">
                <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
              </Field>
              <Field label="Visitor photo URL">
                <input value={photo} onChange={(e) => setPhoto(e.target.value)} />
              </Field>
              <Field label="Remarks">
                <input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Field>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={idVerified} onChange={(e) => setIdVerified(e.target.checked)} />
              ID verified by security guard
            </label>
            <div className="btn-row">
              <button type="button" className="btn ghost" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button type="button" className="btn primary" disabled={saving || !idVerified} onClick={() => void doCheckIn()}>
                {saving ? "Processing…" : "Check In & Issue Gate Pass"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {pass && (
        <section className="panel gate-pass-card">
          <div className="section-head">
            <h3>Digital Gate Pass</h3>
            <button type="button" className="btn tiny ghost" onClick={() => window.print()}>
              Print
            </button>
          </div>
          <div className="gate-pass">
            <div className="gp-brand">OPA GROUP OF INDIA</div>
            <div className="gp-title">Visitor Gate Pass</div>
            <div className="detail-grid">
              <div><span>Gate Pass No.</span><strong>{pass.gate_pass_number}</strong></div>
              <div><span>Visitor Name</span><strong>{pass.visitor?.visitor_name || selected?.visitor_name}</strong></div>
              <div><span>Company</span><strong>{pass.visitor?.company_name}</strong></div>
              <div><span>Person To Meet</span><strong>{pass.visitor?.person_to_meet}</strong></div>
              <div><span>Purpose</span><strong>{pass.visitor?.purpose}</strong></div>
              <div><span>Date</span><strong>{new Date(pass.actual_arrival_time).toLocaleDateString("en-IN")}</strong></div>
              <div><span>Entry Time</span><strong>{new Date(pass.actual_arrival_time).toLocaleTimeString("en-IN")}</strong></div>
              <div><span>Vehicle Number</span><strong>{pass.actual_vehicle_number || "—"}</strong></div>
              <div><span>Security Officer</span><strong>{pass.check_in_by_name || user?.full_name}</strong></div>
            </div>
            {pass.visitor_photo_url ? (
              <img className="gp-photo" src={pass.visitor_photo_url} alt="Visitor" />
            ) : null}
          </div>
        </section>
      )}
    </>
  );
}

export function VisitorsInsidePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<VisitorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [target, setTarget] = useState<VisitorEntry | null>(null);
  const canOut = user && hasPermission(user.role, "security.visitor.checkout");

  async function refresh() {
    try {
      setRows(await listInsideVisitors());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) return subscribeStore(() => void refresh());
  }, []);

  async function checkout() {
    if (!user || !target) return;
    try {
      const updated = await checkOutVisitor({
        entryId: target.id,
        user,
        remarks: remarks || undefined,
      });
      setToast(`Checked out · Duration ${updated.visit_duration}`);
      setTarget(null);
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Visitors Inside</h2>
          <p className="subtitle">Currently on premises — check out when they leave.</p>
        </div>
      </header>
      <Toast message={toast} onClose={() => setToast(null)} />
      <section className="panel table-panel">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState title="No visitors inside" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Gate Pass</th>
                  <th>Visitor</th>
                  <th>Company</th>
                  <th>Meet</th>
                  <th>Entry</th>
                  <th>Persons</th>
                  <th>Security</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.gate_pass_number}</td>
                    <td>{r.visitor?.visitor_name}</td>
                    <td>{r.visitor?.company_name}</td>
                    <td>{r.visitor?.person_to_meet}</td>
                    <td>{new Date(r.actual_arrival_time).toLocaleString("en-IN")}</td>
                    <td>{r.number_of_persons}</td>
                    <td>{r.check_in_by_name || "—"}</td>
                    <td>
                      {canOut && (
                        <button type="button" className="btn tiny" onClick={() => setTarget(r)}>
                          Check Out
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

      <Modal open={Boolean(target)} title="Check out visitor" onClose={() => setTarget(null)}>
        <p>
          Check out <strong>{target?.visitor?.visitor_name}</strong>? Exit time and visit duration will be
          calculated.
        </p>
        <Field label="Remarks">
          <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={() => setTarget(null)}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={() => void checkout()}>
            Confirm Check Out
          </button>
        </div>
      </Modal>
    </>
  );
}

export function VisitorHistoryPage() {
  const [rows, setRows] = useState<VisitorEntry[]>([]);
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [filters, setFilters] = useState({
    date: "",
    visitor: "",
    company: "",
    mobile: "",
    meet: "",
    status: "",
    security: "",
    ceo: "",
  });
  const { exportCsv, exportExcel, exportPdf } = useExportSafe();

  useEffect(() => {
    async function load() {
      const [entries, reqs] = await Promise.all([listVisitorEntries(), listVisitorRequests()]);
      setRows(entries);
      setRequests(reqs);
    }
    void load();
    if (!isSupabaseConfigured) return subscribeStore(() => void load());
  }, []);

  const ceoMap = new Map<string, string>();
  // ceo decision comes from visitor status mostly in local mode

  const merged = requests.map((r) => {
    const entry = rows.find((e) => e.visitor_request_id === r.id);
    return {
      Request: r.request_number,
      Visitor: r.visitor_name,
      Company: r.company_name,
      Mobile: r.mobile,
      "Person To Meet": r.person_to_meet,
      Date: r.requested_date,
      Status: r.status,
      "Security User": r.created_by_name || "",
      "CEO Decision":
        r.status === "APPROVED" || r.status === "REJECTED" || r.status === "RESCHEDULED"
          ? r.status
          : ceoMap.get(r.id) || "",
      "Gate Pass": entry?.gate_pass_number || "",
      "Entry Time": entry?.actual_arrival_time
        ? new Date(entry.actual_arrival_time).toLocaleString("en-IN")
        : "",
      "Exit Time": entry?.exit_time ? new Date(entry.exit_time).toLocaleString("en-IN") : "",
      Duration: entry?.visit_duration || "",
    };
  });

  const filtered = merged.filter((r) => {
    if (filters.date && !String(r.Date).includes(filters.date)) return false;
    if (filters.visitor && !String(r.Visitor).toLowerCase().includes(filters.visitor.toLowerCase()))
      return false;
    if (filters.company && !String(r.Company).toLowerCase().includes(filters.company.toLowerCase()))
      return false;
    if (filters.mobile && !String(r.Mobile).includes(filters.mobile)) return false;
    if (filters.meet && !String(r["Person To Meet"]).toLowerCase().includes(filters.meet.toLowerCase()))
      return false;
    if (filters.status && !String(r.Status).toLowerCase().includes(filters.status.toLowerCase()))
      return false;
    if (filters.security && !String(r["Security User"]).toLowerCase().includes(filters.security.toLowerCase()))
      return false;
    if (filters.ceo && !String(r["CEO Decision"]).toLowerCase().includes(filters.ceo.toLowerCase()))
      return false;
    return true;
  });

  return (
    <>
      <header className="topbar">
        <div>
          <h2>Visitor History</h2>
          <p className="subtitle">Complete history with filters and export.</p>
        </div>
      </header>
      <section className="panel form-panel">
        <div className="form-grid">
          {(
            [
              ["date", "Date"],
              ["visitor", "Visitor"],
              ["company", "Company"],
              ["mobile", "Mobile"],
              ["meet", "Person To Meet"],
              ["status", "Status"],
              ["security", "Security User"],
              ["ceo", "CEO Decision"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                value={filters[key]}
                onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <div className="btn-row wrap">
          <button type="button" className="btn" onClick={() => exportCsv("visitor-history", filtered)}>
            Export CSV
          </button>
          <button type="button" className="btn" onClick={() => exportExcel("visitor-history", filtered)}>
            Export Excel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => exportPdf("visitor-history", "Visitor History", filtered)}
          >
            Export PDF
          </button>
        </div>
      </section>
      <section className="panel table-panel">
        {filtered.length === 0 ? (
          <EmptyState title="No matching history" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {Object.keys(filtered[0]).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j}>{String(v)}</td>
                    ))}
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

function useExportSafe() {
  const [api, setApi] = useState({
    exportCsv: (_f: string, _r: Record<string, unknown>[]) => {},
    exportExcel: (_f: string, _r: Record<string, unknown>[]) => {},
    exportPdf: (_f: string, _t: string, _r: Record<string, unknown>[]) => {},
  });
  useEffect(() => {
    const helpers = {
      exportCsv: (filename: string, rows: Record<string, unknown>[]) => {
        if (!rows.length) return;
        const headers = Object.keys(rows[0]);
        const lines = [
          headers.join(","),
          ...rows.map((r) =>
            headers
              .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
              .join(",")
          ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
      exportExcel: (filename: string, rows: Record<string, unknown>[]) => {
        void import("xlsx").then((XLSX) => {
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, "Report");
          XLSX.writeFile(wb, `${filename}.xlsx`);
        });
      },
      exportPdf: (filename: string, title: string, rows: Record<string, unknown>[]) => {
        void Promise.all([import("jspdf"), import("jspdf-autotable")]).then(([jspdf, autotable]) => {
          const doc = new jspdf.jsPDF({ orientation: "landscape" });
          doc.text("OPA GROUP OF INDIA", 14, 16);
          doc.text(title, 14, 24);
          const headers = Object.keys(rows[0] || {});
          autotable.default(doc, {
            startY: 30,
            head: [headers],
            body: rows.map((r) => headers.map((h) => String(r[h] ?? ""))),
            styles: { fontSize: 8 },
          });
          doc.save(`${filename}.pdf`);
        });
      },
    };
    setApi(helpers);
  }, []);
  return api;
}
