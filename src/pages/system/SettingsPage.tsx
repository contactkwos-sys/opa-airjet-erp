import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { listRows, updateRow, type Row } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { settingsFormSchema, validateForm } from "@/lib/validation";
import { PIN_MANAGED_ROLES, ROLE_PIN_LABELS } from "@/lib/rolePins";
import type { OpaRole } from "@/types/database";
import {
  PageHeader,
  TextInput,
  TextSelect,
  StatCard,
  LoadingState,
  AlertBanner,
} from "@/components/ui";

type Settings = {
  id: string;
  company_name: string;
  timezone: string;
  currency: string;
  fiscal_year: string;
  loom_count: number;
  dobby_count: number;
  plain_count: number;
  address: string;
  whatsapp_settings?: Record<string, unknown>;
};

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

const empty: Settings = {
  id: "",
  company_name: "OPA GROUP OF INDIA",
  timezone: "Asia/Kolkata",
  currency: "INR",
  fiscal_year: "April-March",
  loom_count: 72,
  dobby_count: 36,
  plain_count: 36,
  address: "India",
  whatsapp_settings: { ceo_visit_enabled: true },
};

export default function SettingsPage() {
  const { profile, can, role } = useAuth();
  const canEdit = can("settings", "edit");
  const isSuperAdmin = role === "SUPER_ADMIN";
  const [form, setForm] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shifts, setShifts] = useState<Row[]>([]);
  const [pinRole, setPinRole] = useState<OpaRole>("FACTORY_MANAGER");
  const [pinValue, setPinValue] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [resetRole, setResetRole] = useState<OpaRole>("FACTORY_MANAGER");
  const [resetting, setResetting] = useState(false);
  const [oneTimePin, setOneTimePin] = useState<string | null>(null);
  const [history, setHistory] = useState<PinHistoryRow[]>([]);
  const [locked, setLocked] = useState<LockedAccount[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);

  const [myPinAccount, setMyPinAccount] = useState<{
    employee_id: string;
    display_name: string;
    role: OpaRole;
  } | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newSelfPin, setNewSelfPin] = useState("");
  const [confirmSelfPin, setConfirmSelfPin] = useState("");
  const [selfPinSaving, setSelfPinSaving] = useState(false);
  const [selfPinMessage, setSelfPinMessage] = useState<string | null>(null);
  const [selfPinError, setSelfPinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [settings, shiftRows] = await Promise.all([
      listRows("opa_company_settings", { limit: 1 }),
      listRows("opa_shifts", {
        orderBy: { column: "code", ascending: true },
      }),
    ]);
    const row = settings.data[0];
    if (row) {
      setForm({
        id: String(row.id),
        company_name: String(row.company_name ?? empty.company_name),
        timezone: String(row.timezone ?? empty.timezone),
        currency: String(row.currency ?? empty.currency),
        fiscal_year: String(row.fiscal_year ?? empty.fiscal_year),
        loom_count: Number(row.loom_count ?? 72),
        dobby_count: Number(row.dobby_count ?? 36),
        plain_count: Number(row.plain_count ?? 36),
        address: String(row.address ?? ""),
        whatsapp_settings:
          (row.whatsapp_settings as Record<string, unknown>) ?? {},
      });
    }
    setShifts(shiftRows.data);
    setLoading(false);
  }, []);

  const loadAdminPinData = useCallback(async () => {
    if (!isSuperAdmin) return;
    const sb = getSupabase();
    if (!sb) return;
    const [histRes, lockedRes] = await Promise.all([
      sb
        .from("opa_pin_change_history")
        .select(
          "id, subject_type, role, employee_id, employee_name, action, changed_by_name, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      sb.rpc("opa_list_locked_pin_accounts"),
    ]);
    if (!histRes.error && histRes.data) {
      setHistory(histRes.data as PinHistoryRow[]);
    }
    if (!lockedRes.error && lockedRes.data) {
      setLocked(lockedRes.data as LockedAccount[]);
    }
  }, [isSuperAdmin]);

  const loadMyPinAccount = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setMyPinAccount(null);
      return;
    }
    const { data, error } = await sb.rpc("opa_resolve_my_pin_employee");
    if (error || !data) {
      setMyPinAccount(null);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.employee_id) {
      setMyPinAccount(null);
      return;
    }
    setMyPinAccount({
      employee_id: String(row.employee_id),
      display_name: String(row.display_name ?? profile?.full_name ?? "Employee"),
      role: row.role as OpaRole,
    });
  }, [profile?.full_name]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAdminPinData();
  }, [loadAdminPinData]);

  useEffect(() => {
    void loadMyPinAccount();
  }, [loadMyPinAccount]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    const validated = validateForm(settingsFormSchema, form);
    if (validated.errors) {
      setErrors(validated.errors);
      setSaving(false);
      return;
    }
    setErrors({});
    const payload = {
      company_name: form.company_name,
      timezone: form.timezone,
      currency: form.currency,
      fiscal_year: form.fiscal_year,
      loom_count: form.loom_count,
      dobby_count: form.dobby_count,
      plain_count: form.plain_count,
      address: form.address,
      whatsapp_settings: {
        ...(form.whatsapp_settings ?? {}),
        secrets: "configured on server",
      },
    };
    if (form.id) {
      await updateRow("opa_company_settings", form.id, payload, {
        module: "settings",
        user_id: profile?.id,
        user_name: profile?.full_name,
      });
    }
    setMessage("Settings saved.");
    setSaving(false);
  }

  async function handlePinRotate(e: React.FormEvent) {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setPinMessage(null);
    setPinError(null);
    setOneTimePin(null);
    if (!/^[0-9]{4}$/.test(pinValue)) {
      setPinError("PIN must be exactly 4 digits.");
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
      p_pin: pinValue,
    });
    setPinSaving(false);
    if (error) {
      setPinError(error.message);
      return;
    }
    setPinMessage(`PIN updated for ${ROLE_PIN_LABELS[pinRole]}.`);
    setPinValue("");
    void loadAdminPinData();
  }

  async function handleEmergencyReset(e: React.FormEvent) {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setPinMessage(null);
    setPinError(null);
    setOneTimePin(null);
    const sb = getSupabase();
    if (!sb) {
      setPinError("Database is not configured.");
      return;
    }
    setResetting(true);
    const { data, error } = await sb.rpc("opa_emergency_reset_role_pin", {
      p_role: resetRole,
    });
    setResetting(false);
    if (error) {
      setPinError(error.message);
      return;
    }
    const temp = String(data ?? "");
    setOneTimePin(temp);
    setPinMessage(
      `Emergency reset for ${ROLE_PIN_LABELS[resetRole]}. Copy the temporary PIN now — it will not be shown again.`,
    );
    void loadAdminPinData();
  }

  async function handleUnlock(account: LockedAccount) {
    if (!isSuperAdmin) return;
    const sb = getSupabase();
    if (!sb) return;
    setAdminBusy(true);
    setPinError(null);
    const { error } = await sb.rpc("opa_unlock_pin_account", {
      p_subject_type: account.subject_type,
      p_subject_id: account.subject_id,
    });
    setAdminBusy(false);
    if (error) {
      setPinError(error.message);
      return;
    }
    setPinMessage(`Unlocked ${account.display_name}.`);
    void loadAdminPinData();
  }

  async function handleChangeMyPin(e: React.FormEvent) {
    e.preventDefault();
    setSelfPinMessage(null);
    setSelfPinError(null);
    if (!/^[0-9]{4}$/.test(currentPin) || !/^[0-9]{4}$/.test(newSelfPin)) {
      setSelfPinError("PINs must be exactly 4 digits.");
      return;
    }
    if (newSelfPin !== confirmSelfPin) {
      setSelfPinError("New PIN and confirmation do not match.");
      return;
    }
    if (currentPin === newSelfPin) {
      setSelfPinError("New PIN must be different from your current PIN.");
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setSelfPinError("Database is not configured.");
      return;
    }
    setSelfPinSaving(true);
    const { error } = await sb.rpc("opa_change_my_pin", {
      p_current_pin: currentPin,
      p_new_pin: newSelfPin,
    });
    setSelfPinSaving(false);
    if (error) {
      setSelfPinError(error.message);
      return;
    }
    setSelfPinMessage("Your PIN was updated. Use the new PIN next time you sign in.");
    setCurrentPin("");
    setNewSelfPin("");
    setConfirmSelfPin("");
    if (isSuperAdmin) void loadAdminPinData();
  }

  if (loading) return <LoadingState label="Loading settings…" />;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Company, factory loom counts, shifts and WhatsApp configuration."
      />

      {message ? <AlertBanner tone="info" title={message} /> : null}

      {myPinAccount ? (
        <section className="panel page-card">
          <h3>Change my PIN</h3>
          <p>
            Update your personal login PIN for{" "}
            <strong>{myPinAccount.display_name}</strong> (
            {ROLE_PIN_LABELS[myPinAccount.role] ?? myPinAccount.role}). Enter your
            current PIN, then choose a new 4-digit PIN. Super Admin is not required.
          </p>
          {selfPinMessage ? <AlertBanner tone="info" title={selfPinMessage} /> : null}
          {selfPinError ? <AlertBanner tone="danger" title={selfPinError} /> : null}
          <form className="form-grid" onSubmit={(e) => void handleChangeMyPin(e)}>
            <TextInput
              label="Current PIN"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={4}
              value={currentPin}
              onChange={(e) =>
                setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              required
            />
            <TextInput
              label="New PIN"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={newSelfPin}
              onChange={(e) =>
                setNewSelfPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              required
            />
            <TextInput
              label="Confirm new PIN"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={confirmSelfPin}
              onChange={(e) =>
                setConfirmSelfPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              required
            />
            <div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={selfPinSaving}
              >
                {selfPinSaving ? "Updating…" : "Change my PIN"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="fleet-grid">
        <StatCard label="Looms" value={form.loom_count} />
        <StatCard label="Dobby" value={form.dobby_count} />
        <StatCard label="Plain" value={form.plain_count} />
        <StatCard label="Shifts" value={shifts.length || 3} />
      </div>

      <section className="panel page-card">
        <h3>Company</h3>
        <form className="form-grid" onSubmit={handleSave}>
          <TextInput
            label="Company name"
            required
            value={form.company_name}
            error={errors.company_name}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
          />
          <TextInput
            label="Address"
            value={form.address}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <TextInput
            label="Timezone"
            required
            value={form.timezone}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
          />
          <TextInput
            label="Currency"
            required
            value={form.currency}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          />
          <TextInput
            label="Fiscal year"
            value={form.fiscal_year}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, fiscal_year: e.target.value }))}
          />
          <TextInput
            label="Total looms"
            type="number"
            required
            value={form.loom_count}
            error={errors.loom_count}
            disabled={!canEdit}
            onChange={(e) =>
              setForm((f) => ({ ...f, loom_count: Number(e.target.value) }))
            }
          />
          <TextInput
            label="Dobby count"
            type="number"
            value={form.dobby_count}
            disabled={!canEdit}
            onChange={(e) =>
              setForm((f) => ({ ...f, dobby_count: Number(e.target.value) }))
            }
          />
          <TextInput
            label="Plain count"
            type="number"
            value={form.plain_count}
            disabled={!canEdit}
            onChange={(e) =>
              setForm((f) => ({ ...f, plain_count: Number(e.target.value) }))
            }
          />
          {canEdit ? (
            <div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="panel page-card">
        <h3>Shifts</h3>
        <ul className="shift-list">
          {(shifts.length
            ? shifts
            : [
                { id: "A", code: "A", name: "SHIFT A", start_time: "06:00", end_time: "14:00" },
                { id: "B", code: "B", name: "SHIFT B", start_time: "14:00", end_time: "22:00" },
                { id: "C", code: "C", name: "SHIFT C", start_time: "22:00", end_time: "06:00" },
              ]
          ).map((s) => (
            <li key={String(s.id)}>
              <strong>{String(s.code ?? s.name)}</strong>{" "}
              {String(s.name ?? "")} · {String(s.start_time ?? "")}–{String(s.end_time ?? "")}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel page-card">
        <h3>WhatsApp (CEO visits)</h3>
        <p>
          Notification toggles are stored in company settings. API tokens,
          phone number IDs and the CEO WhatsApp number are{" "}
          <strong>configured on server</strong> as Edge Function secrets — never
          in the browser.
        </p>
        <ul>
          <li>
            CEO visit notify:{" "}
            {form.whatsapp_settings?.notify_ceo_on_visit === false ? "Off" : "On"}
          </li>
          <li>Secrets: configured on server</li>
        </ul>
      </section>

      {isSuperAdmin ? (
        <>
          <section className="panel page-card">
            <h3>Role PIN management</h3>
            <p>
              Rotate 4-digit role PINs. Hashes are stored server-side only — the
              new PIN is never saved in the browser after submit.
            </p>
            <p>
              <Link to="/admin/employee-overview">Open Employee &amp; Role Overview →</Link>
            </p>
            {pinMessage ? <AlertBanner tone="info" title={pinMessage} /> : null}
            {pinError ? <AlertBanner tone="danger" title={pinError} /> : null}
            {oneTimePin ? (
              <div className="one-time-pin" role="status">
                <span className="label">Temporary PIN (copy now)</span>
                <code className="one-time-pin-value">{oneTimePin}</code>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(oneTimePin);
                  }}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setOneTimePin(null)}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
            <form className="form-grid" onSubmit={(e) => void handlePinRotate(e)}>
              <TextSelect
                label="Role"
                value={pinRole}
                onChange={(e) => setPinRole(e.target.value as OpaRole)}
              >
                {PIN_MANAGED_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_PIN_LABELS[r]}
                  </option>
                ))}
              </TextSelect>
              <TextInput
                label="New 4-digit PIN"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pinValue}
                onChange={(e) =>
                  setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
              />
              <div>
                <button type="submit" className="btn btn-primary" disabled={pinSaving}>
                  {pinSaving ? "Updating…" : "Update role PIN"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel page-card">
            <h3>Emergency Reset</h3>
            <p>
              Generate a temporary system PIN for any role. Shown once only —
              never stored in plain text.
            </p>
            <form className="form-grid" onSubmit={(e) => void handleEmergencyReset(e)}>
              <TextSelect
                label="Role to reset"
                value={resetRole}
                onChange={(e) => setResetRole(e.target.value as OpaRole)}
              >
                {PIN_MANAGED_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_PIN_LABELS[r]}
                  </option>
                ))}
              </TextSelect>
              <div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resetting}
                >
                  {resetting ? "Resetting…" : "Generate temporary PIN"}
                </button>
              </div>
            </form>
          </section>

          <section className="panel page-card">
            <h3>PIN Change History</h3>
            <p>Audit log of role and employee PIN changes.</p>
            {history.length === 0 ? (
              <p className="muted">No PIN changes recorded yet.</p>
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
                        <td>
                          {format(new Date(h.created_at), "dd MMM yyyy HH:mm")}
                        </td>
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
          </section>

          <section className="panel page-card">
            <h3>Locked Accounts</h3>
            <p>
              Accounts locked after too many wrong PIN attempts. Unlock to clear
              the lockout.
            </p>
            {locked.length === 0 ? (
              <p className="muted">No locked accounts.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
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
                        <td>{a.subject_type}</td>
                        <td>{a.display_name}</td>
                        <td>{ROLE_PIN_LABELS[a.role] ?? a.role}</td>
                        <td>{a.failed_attempts}</td>
                        <td>
                          {format(new Date(a.locked_until), "dd MMM yyyy HH:mm")}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={adminBusy}
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
            )}
          </section>
        </>
      ) : null}
    </>
  );
}
