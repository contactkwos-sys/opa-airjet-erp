import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { listRows } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  PIN_MANAGED_ROLES,
  COMPANY_PIN_MANAGED_ROLES,
  ROLE_PIN_LABELS,
} from "@/lib/rolePins";
import { isDeveloperOverride, isPinAdmin } from "@/lib/adminTiers";
import type { OpaRole } from "@/types/database";
import {
  PageHeader,
  TextInput,
  TextSelect,
  LoadingState,
  AlertBanner,
  EmptyState,
} from "@/components/ui";

type PinHistoryRow = {
  id: string;
  subject_type: string;
  role: OpaRole;
  employee_id: string | null;
  employee_name: string | null;
  action: string;
  changed_by_name: string | null;
  created_at: string;
};

type LockedAccount = {
  subject_type: string;
  subject_id: string;
  role: OpaRole;
  display_name: string;
  failed_attempts: number;
  locked_until: string;
};

type ModuleAccessRow = {
  role: OpaRole;
  label: string;
  pinStatus: "Configured" | "Not set";
  lastChanged: string | null;
};

const TABS = [
  { id: "access", label: "Module Access" },
  { id: "pin", label: "PIN Management" },
  { id: "logs", label: "Access Logs" },
  { id: "audit", label: "Security Audit" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SecurityAccessPage() {
  const { role, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabId) || "access";
  const pinAdmin = isPinAdmin(role);
  const developer = isDeveloperOverride(role);
  const managedRoles = developer ? PIN_MANAGED_ROLES : COMPANY_PIN_MANAGED_ROLES;

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PinHistoryRow[]>([]);
  const [locked, setLocked] = useState<LockedAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [pinRole, setPinRole] = useState<OpaRole>("FACTORY_MANAGER");
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = getSupabase();

    if (pinAdmin && sb) {
      const [histRes, lockedRes] = await Promise.all([
        sb
          .from("opa_pin_change_history")
          .select(
            "id, subject_type, role, employee_id, employee_name, action, changed_by_name, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        sb.rpc("opa_list_locked_pin_accounts"),
      ]);
      if (!histRes.error && histRes.data) {
        setHistory(histRes.data as PinHistoryRow[]);
      }
      if (!lockedRes.error && lockedRes.data) {
        setLocked(lockedRes.data as LockedAccount[]);
      }
    }

    if (developer) {
      const auditRes = await listRows("opa_audit_logs", {
        orderBy: { column: "created_at", ascending: false },
        limit: 100,
      });
      setAuditLogs(auditRes.data);
    }

    setLoading(false);
  }, [pinAdmin, developer]);

  useEffect(() => {
    void load();
  }, [load]);

  const moduleAccess = useMemo((): ModuleAccessRow[] => {
    const lastByRole = new Map<string, string>();
    for (const h of history) {
      if (h.subject_type === "role" && !lastByRole.has(h.role)) {
        lastByRole.set(h.role, h.created_at);
      }
    }
    return managedRoles.map((r) => ({
      role: r,
      label: ROLE_PIN_LABELS[r],
      pinStatus: lastByRole.has(r) ? "Configured" : "Configured",
      lastChanged: lastByRole.get(r) ?? null,
    }));
  }, [history, managedRoles]);

  async function handlePinUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!pinAdmin) return;
    setPinMessage(null);
    setPinError(null);

    if (!/^[0-9]{4}$/.test(newPin)) {
      setPinError("PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PIN and confirmation do not match.");
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      setPinError("Database is not configured.");
      return;
    }

    setPinSaving(true);
    const { error } = await sb.rpc("opa_set_role_pin", {
      p_role: pinRole,
      p_pin: newPin,
    });
    setPinSaving(false);

    if (error) {
      setPinError(error.message);
      return;
    }

    setPinMessage(`PIN updated for ${ROLE_PIN_LABELS[pinRole]}. PIN values are never displayed.`);
    setOldPin("");
    setNewPin("");
    setConfirmPin("");
    void load();
  }

  async function handleUnlock(account: LockedAccount) {
    const sb = getSupabase();
    if (!sb || !pinAdmin) return;
    const { error } = await sb.rpc("opa_unlock_pin_account", {
      p_subject_type: account.subject_type,
      p_subject_id: account.subject_id,
    });
    if (error) {
      setPinError(error.message);
      return;
    }
    setPinMessage(`Unlocked ${account.display_name}.`);
    void load();
  }

  if (!can("settings", "view") && !pinAdmin) {
    return (
      <EmptyState
        title="Access denied"
        description="Security & Access Control is available to administrators only."
      />
    );
  }

  if (loading) return <LoadingState label="Loading security data…" />;

  return (
    <>
      <PageHeader
        title="Security & Access Control"
        subtitle="Module PIN management, access logs, and security audit."
      />

      <div className="tab-bar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "active" : undefined}
            onClick={() => setSearchParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "access" ? (
        <section className="panel table-panel">
          <p className="muted">
            Module access by role. PIN values are never shown — only configuration status.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Role</th>
                  <th>PIN Status</th>
                  <th>Last Changed</th>
                  <th>Status</th>
                  {pinAdmin ? <th>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {moduleAccess.map((row) => (
                  <tr key={row.role}>
                    <td>{row.label}</td>
                    <td>{row.role.replace(/_/g, " ")}</td>
                    <td>{row.pinStatus}</td>
                    <td>
                      {row.lastChanged
                        ? format(new Date(row.lastChanged), "dd MMM yyyy")
                        : "—"}
                    </td>
                    <td>
                      <span className="badge status-approved">Active</span>
                    </td>
                    {pinAdmin ? (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setPinRole(row.role);
                            setSearchParams({ tab: "pin" });
                          }}
                        >
                          Change PIN
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: "1rem" }}>
            <Link to="/admin/employee-overview">Employee Links &amp; Roles →</Link>
          </p>
        </section>
      ) : null}

      {tab === "pin" && pinAdmin ? (
        <section className="panel page-card">
          <h3>PIN Management</h3>
          <p>
            Rotate module PINs. Hashes are stored server-side only — PIN values are never
            displayed after save.
          </p>
          {pinMessage ? <AlertBanner tone="info" title={pinMessage} /> : null}
          {pinError ? <AlertBanner tone="danger" title={pinError} /> : null}
          <form className="form-grid" onSubmit={(e) => void handlePinUpdate(e)}>
            <TextSelect
              label="Module / Role"
              value={pinRole}
              onChange={(e) => setPinRole(e.target.value as OpaRole)}
            >
              {managedRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_PIN_LABELS[r]}
                </option>
              ))}
            </TextSelect>
            <TextInput
              label="Old PIN (if required)"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="off"
            />
            <TextInput
              label="New PIN"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="new-password"
              required
            />
            <TextInput
              label="Confirm PIN"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="new-password"
              required
            />
            <div>
              <button type="submit" className="btn btn-primary" disabled={pinSaving}>
                {pinSaving ? "Updating…" : "Update PIN"}
              </button>
            </div>
          </form>
        </section>
      ) : tab === "pin" ? (
        <EmptyState title="Access denied" description="PIN management requires administrator access." />
      ) : null}

      {tab === "logs" ? (
        <section className="panel table-panel">
          <h3>Access Logs</h3>
          <p>PIN changes and login events. PIN values are never logged.</p>
          {history.length === 0 ? (
            <p className="muted">No access logs recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Role</th>
                    <th>Subject</th>
                    <th>Action</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{format(new Date(h.created_at), "dd MMM yyyy HH:mm")}</td>
                      <td>{ROLE_PIN_LABELS[h.role] ?? h.role}</td>
                      <td>
                        {h.subject_type === "employee"
                          ? h.employee_name ?? "Employee"
                          : "Role PIN"}
                      </td>
                      <td>{h.action}</td>
                      <td>{h.changed_by_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pinAdmin && locked.length > 0 ? (
            <>
              <h3 style={{ marginTop: "1.5rem" }}>Locked Accounts</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Attempts</th>
                      <th>Locked until</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {locked.map((a) => (
                      <tr key={`${a.subject_type}-${a.subject_id}`}>
                        <td>{a.display_name}</td>
                        <td>{ROLE_PIN_LABELS[a.role] ?? a.role}</td>
                        <td>{a.failed_attempts}</td>
                        <td>{format(new Date(a.locked_until), "dd MMM yyyy HH:mm")}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void handleUnlock(a)}
                          >
                            Unlock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {tab === "audit" && developer ? (
        <section className="panel table-panel">
          <h3>Security Audit</h3>
          <p>Full system audit log — read only. SUPER_ADMIN access required.</p>
          {auditLogs.length === 0 ? (
            <p className="muted">No audit entries.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Record</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={String(log.id)}>
                      <td>
                        {log.created_at
                          ? format(new Date(String(log.created_at)), "dd MMM yyyy HH:mm")
                          : "—"}
                      </td>
                      <td>{String(log.user_name ?? "—")}</td>
                      <td>{String(log.action ?? "—")}</td>
                      <td>{String(log.module ?? "—")}</td>
                      <td>{String(log.record_id ?? "—").slice(0, 8)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ marginTop: "1rem" }}>
            <Link to="/audit">Full Audit Log →</Link>
          </p>
        </section>
      ) : tab === "audit" ? (
        <EmptyState
          title="Access denied"
          description="Full security audit requires SUPER_ADMIN access."
        />
      ) : null}
    </>
  );
}
