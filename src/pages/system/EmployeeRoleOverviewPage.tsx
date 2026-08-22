import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/lib/supabase";
import {
  EMPLOYEE_PIN_LOGIN_ROLES,
  COMPANY_PIN_MANAGED_ROLES,
  PIN_MANAGED_ROLES,
  ROLE_PIN_LABELS,
} from "@/lib/rolePins";
import { isDeveloperOverride, isPinAdmin } from "@/lib/adminTiers";
import {
  buildEmployeeAccessMessage,
  buildEmployeeLoginLink,
  copyText,
  shareOrCopy,
  whatsappShareUrl,
} from "@/lib/employeeLinks";
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

const PROTECTED_CREATE_ROLES: OpaRole[] = [
  "CEO",
  "DIRECTOR",
  "COMPANY_ADMIN",
  "SUPER_ADMIN",
];

/**
 * CEO / Director / Developer Override — Employee & Role Overview + shareable links.
 * Route: /admin/employee-overview
 */
export default function EmployeeRoleOverviewPage() {
  const { role, loading: authLoading } = useAuth();
  const pinAdmin = isPinAdmin(role);
  const developer = isDeveloperOverride(role);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  const creatableRoles = useMemo(() => {
    if (developer) {
      return [...new Set([...PIN_MANAGED_ROLES, ...EMPLOYEE_PIN_LOGIN_ROLES])];
    }
    return [
      ...new Set([
        ...EMPLOYEE_PIN_LOGIN_ROLES.filter(
          (r) => !PROTECTED_CREATE_ROLES.includes(r),
        ),
        ...COMPANY_PIN_MANAGED_ROLES,
      ]),
    ];
  }, [developer]);

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
    if (!pinAdmin) return;
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
  }, [pinAdmin]);

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
    for (const r of creatableRoles) {
      if (!map.has(r)) map.set(r, []);
    }
    for (const emp of employees) {
      const list = map.get(emp.role) ?? [];
      list.push(emp);
      map.set(emp.role, list);
    }
    return [...map.entries()].filter(
      ([r, list]) =>
        (EMPLOYEE_PIN_LOGIN_ROLES.includes(r) &&
          !PROTECTED_CREATE_ROLES.includes(r)) ||
        list.length > 0,
    );
  }, [employees, creatableRoles]);

  async function notifyLinkAction(result: "shared" | "copied" | "failed", label: string) {
    if (result === "shared") setMessage(`${label} opened in the share sheet.`);
    else if (result === "copied") setMessage(`${label} copied — paste into WhatsApp or SMS.`);
    else setMessage(`Could not copy ${label}. Long-press / select the text instead.`);
  }

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
      `Added ${name} (${ROLE_PIN_LABELS[newRole]}). Copy their employee link + PIN below to send via WhatsApp/SMS.`,
    );
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
      `PIN updated for ${emp.display_name}. Copy link + PIN below — it will not be shown again after you leave.`,
    );
    setSetPinForId(null);
    setManualPin("");
    void load();
  }

  if (authLoading) return <LoadingState label="Loading…" />;
  if (!pinAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title="Employee & Role Overview"
        subtitle="Add named PIN logins, then copy each employee’s personal login link to send from your phone or desktop."
      />

      {message ? <AlertBanner tone="info" title={message} /> : null}
      {error ? <AlertBanner tone="danger" title={error} /> : null}

      <section className="panel page-card sticky-add-panel">
        <h3>Add employee</h3>
        <p className="muted">
          Enter name + optional starting PIN, press Add &amp; next. After each add, copy the
          employee link (or link + PIN) and send it yourself via WhatsApp or SMS.
        </p>
        <form className="form-grid bulk-add-form" onSubmit={(e) => void handleCreate(e)}>
          <TextSelect
            label="Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as OpaRole)}
          >
            {creatableRoles.map((r) => (
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
        <section className="panel page-card" id="employee-links-session">
          <h3>Employee Links — copy &amp; send now</h3>
          <p className="muted">
            One-time PIN is shown for this browser session only. Use Copy link+PIN or WhatsApp
            to send access from mobile or desktop.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>PIN</th>
                  <th>Personal link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessionAdded.map((row) => {
                  const link = buildEmployeeLoginLink({
                    origin,
                    role: row.role,
                    employeeId: row.id,
                  });
                  const fullMsg = buildEmployeeAccessMessage({
                    origin,
                    role: row.role,
                    employeeId: row.id,
                    displayName: row.display_name,
                    pin: row.temporary_pin,
                  });
                  return (
                    <tr key={`${row.id}-${row.added_at}`}>
                      <td>{row.display_name}</td>
                      <td>{ROLE_PIN_LABELS[row.role]}</td>
                      <td>
                        <code className="one-time-pin-value session-pin">
                          {row.temporary_pin}
                        </code>
                      </td>
                      <td className="employee-link-cell">
                        <code className="employee-link-url">{link}</code>
                      </td>
                      <td>
                        <div className="employee-link-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              void shareOrCopy(fullMsg).then((r) =>
                                notifyLinkAction(r, `Link + PIN for ${row.display_name}`),
                              );
                            }}
                          >
                            Copy link+PIN
                          </button>
                          <a
                            className="btn btn-ghost"
                            href={whatsappShareUrl(fullMsg)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              void copyText(link).then((ok) =>
                                notifyLinkAction(
                                  ok ? "copied" : "failed",
                                  `Link for ${row.display_name}`,
                                ),
                              );
                            }}
                          >
                            Copy link
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      <section className="panel page-card" id="employee-links">
        <h3>Employee Links</h3>
        <p className="muted">
          Every employee has a unique login link that opens /login with their role and name
          already selected. Copy the link anytime; include a fresh PIN after you set one.
        </p>
        {loading ? (
          <LoadingState label="Loading employees…" />
        ) : employees.length === 0 ? (
          <p className="muted">No employees yet — add someone above.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Login link</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const link = buildEmployeeLoginLink({
                    origin,
                    role: emp.role,
                    employeeId: emp.id,
                  });
                  const linkOnlyMsg = buildEmployeeAccessMessage({
                    origin,
                    role: emp.role,
                    employeeId: emp.id,
                    displayName: emp.display_name,
                  });
                  return (
                    <tr key={emp.id}>
                      <td>{emp.display_name}</td>
                      <td>{ROLE_PIN_LABELS[emp.role]}</td>
                      <td>
                        {!emp.is_active
                          ? "Inactive"
                          : emp.locked_until &&
                              new Date(emp.locked_until) > new Date()
                            ? "Locked"
                            : "Active"}
                      </td>
                      <td className="employee-link-cell">
                        <code className="employee-link-url">{link}</code>
                      </td>
                      <td>
                        <div className="employee-link-actions">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => {
                              void shareOrCopy(linkOnlyMsg).then((r) =>
                                notifyLinkAction(r, `Link for ${emp.display_name}`),
                              );
                            }}
                          >
                            Copy / Share
                          </button>
                          <a
                            className="btn btn-ghost"
                            href={whatsappShareUrl(linkOnlyMsg)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loading ? null : (
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
