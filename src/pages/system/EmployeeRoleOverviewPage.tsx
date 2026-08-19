import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/lib/supabase";
import {
  EMPLOYEE_PIN_LOGIN_ROLES,
  PIN_MANAGED_ROLES,
  ROLE_PIN_LABELS,
} from "@/lib/rolePins";
import type { OpaRole } from "@/types/database";
import {
  PageHeader,
  TextInput,
  TextSelect,
  LoadingState,
  AlertBanner,
} from "@/components/ui";

type PinEmployee = {
  id: string;
  role: OpaRole;
  display_name: string;
  is_active: boolean;
  pin_updated_at: string;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
};

type SessionAdded = {
  id: string;
  role: OpaRole;
  display_name: string;
  temporary_pin: string;
  added_at: string;
};

/**
 * Super Admin only — Employee & Role Overview.
 * Route: /admin/employee-overview (not linked from public UI).
 */
export default function EmployeeRoleOverviewPage() {
  const { role, loading: authLoading } = useAuth();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [employees, setEmployees] = useState<PinEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionAdded, setSessionAdded] = useState<SessionAdded[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newRole, setNewRole] = useState<OpaRole>("SECURITY_GUARD");
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [creating, setCreating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [setPinForId, setSetPinForId] = useState<string | null>(null);
  const [manualPin, setManualPin] = useState("");

  const load = useCallback(async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    setError(null);
    const sb = getSupabase();
    if (!sb) {
      setError("Database is not configured.");
      setLoading(false);
      return;
    }
    const { data, error: rpcError } = await sb.rpc("opa_list_pin_employees_admin");
    if (rpcError) {
      setError(rpcError.message);
      setEmployees([]);
    } else {
      setEmployees((data ?? []) as PinEmployee[]);
    }
    setLoading(false);
  }, [isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!creating) {
      nameInputRef.current?.focus();
    }
  }, [creating, sessionAdded.length]);

  const byRole = useMemo(() => {
    const map = new Map<OpaRole, PinEmployee[]>();
    for (const r of [...EMPLOYEE_PIN_LOGIN_ROLES, ...PIN_MANAGED_ROLES]) {
      if (!map.has(r)) map.set(r, []);
    }
    for (const emp of employees) {
      const list = map.get(emp.role) ?? [];
      list.push(emp);
      map.set(emp.role, list);
    }
    return [...map.entries()].filter(
      ([r, list]) => EMPLOYEE_PIN_LOGIN_ROLES.includes(r) || list.length > 0,
    );
  }, [employees]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const name = newName.trim();
    if (name.length < 2) {
      setError("Enter an employee name.");
      return;
    }
    if (newPin && !/^[0-9]{4}$/.test(newPin)) {
      setError("Starting PIN must be exactly 4 digits (or leave blank to auto-generate).");
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setCreating(true);
    const { data, error: rpcError } = await sb.rpc("opa_create_pin_employee", {
      p_role: newRole,
      p_display_name: name,
      p_pin: newPin.trim() || null,
    });
    setCreating(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const temp = String(row?.temporary_pin ?? "");
    const empId = String(row?.employee_id ?? "");
    setSessionAdded((prev) => [
      {
        id: empId || `${Date.now()}`,
        role: newRole,
        display_name: name,
        temporary_pin: temp,
        added_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setMessage(
      `Added ${name} (${ROLE_PIN_LABELS[newRole]}). Form is ready for the next employee — role kept.`,
    );
    // Keep role; clear name + PIN for rapid successive adds (no re-navigation).
    setNewName("");
    setNewPin("");
    void load();
    queueMicrotask(() => nameInputRef.current?.focus());
  }

  async function handleSetPin(emp: PinEmployee, useManual: boolean) {
    setMessage(null);
    setError(null);
    const sb = getSupabase();
    if (!sb) return;
    if (useManual && !/^[0-9]{4}$/.test(manualPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    setBusyId(emp.id);
    const { data, error: rpcError } = await sb.rpc("opa_set_employee_pin", {
      p_employee_id: emp.id,
      p_pin: useManual ? manualPin : null,
    });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const temp = String(data ?? "");
    setSessionAdded((prev) => [
      {
        id: emp.id,
        role: emp.role,
        display_name: emp.display_name,
        temporary_pin: temp,
        added_at: new Date().toISOString(),
      },
      ...prev.filter((s) => s.id !== emp.id),
    ]);
    setMessage(
      `PIN updated for ${emp.display_name}. Copy it from the session list below — it will not be shown again after you leave.`,
    );
    setSetPinForId(null);
    setManualPin("");
    void load();
  }

  if (authLoading) return <LoadingState label="Loading…" />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title="Employee & Role Overview"
        subtitle="Add named PIN logins under each role. Stay on this page to add many in a row — role is kept after each add."
      />

      {message ? <AlertBanner tone="info" title={message} /> : null}
      {error ? <AlertBanner tone="danger" title={error} /> : null}

      <section className="panel page-card sticky-add-panel">
        <h3>Add employee</h3>
        <p className="muted">
          Enter name + optional starting PIN, press Add &amp; next. Role stays selected so you can
          add the whole team without leaving this screen. Copy each one-time PIN from the session
          list — existing PINs are never shown again later.
        </p>
        <form className="form-grid bulk-add-form" onSubmit={(e) => void handleCreate(e)}>
          <TextSelect
            label="Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as OpaRole)}
          >
            {EMPLOYEE_PIN_LOGIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_PIN_LABELS[r]}
              </option>
            ))}
          </TextSelect>
          <label className="form-field">
            <span className="form-label">Employee name</span>
            <input
              ref={nameInputRef}
              className="form-control"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Pawan Bhai"
              autoComplete="off"
            />
          </label>
          <TextInput
            label="Starting PIN (optional — blank = auto-generate)"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={newPin}
            onChange={(e) =>
              setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
          />
          <div className="bulk-add-actions">
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? "Adding…" : "Add & next"}
            </button>
          </div>
        </form>
      </section>

      {sessionAdded.length > 0 ? (
        <section className="panel page-card">
          <h3>This session — copy PINs now</h3>
          <p className="muted">
            Shown once for this browser session. After you leave or dismiss, these values are gone.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Starting PIN</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessionAdded.map((row) => (
                  <tr key={`${row.id}-${row.added_at}`}>
                    <td>{row.display_name}</td>
                    <td>{ROLE_PIN_LABELS[row.role]}</td>
                    <td>
                      <code className="one-time-pin-value session-pin">{row.temporary_pin}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          void navigator.clipboard?.writeText(row.temporary_pin);
                        }}
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSessionAdded([])}
          >
            Clear session PIN list
          </button>
        </section>
      ) : null}

      {loading ? (
        <LoadingState label="Loading employees…" />
      ) : (
        byRole.map(([r, list]) => (
          <section className="panel page-card" key={r}>
            <h3>
              {ROLE_PIN_LABELS[r]}{" "}
              <span className="muted">({list.length})</span>
            </h3>
            {list.length === 0 ? (
              <p className="muted">No employees under this role yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Last PIN change</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((emp) => (
                      <tr key={emp.id}>
                        <td>{emp.display_name}</td>
                        <td>
                          {format(
                            new Date(emp.pin_updated_at),
                            "dd MMM yyyy HH:mm",
                          )}
                        </td>
                        <td>
                          {!emp.is_active
                            ? "Inactive"
                            : emp.locked_until &&
                                new Date(emp.locked_until) > new Date()
                              ? "Locked"
                              : "Active"}
                        </td>
                        <td>
                          {setPinForId === emp.id ? (
                            <div className="inline-pin-set">
                              <TextInput
                                label="New PIN (blank = generate)"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={4}
                                value={manualPin}
                                onChange={(e) =>
                                  setManualPin(
                                    e.target.value.replace(/\D/g, "").slice(0, 4),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={busyId === emp.id}
                                onClick={() =>
                                  void handleSetPin(emp, Boolean(manualPin))
                                }
                              >
                                {busyId === emp.id
                                  ? "Saving…"
                                  : manualPin
                                    ? "Set PIN"
                                    : "Generate PIN"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => {
                                  setSetPinForId(null);
                                  setManualPin("");
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => {
                                setSetPinForId(emp.id);
                                setManualPin("");
                              }}
                            >
                              Set New PIN
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
        ))
      )}
    </>
  );
}
