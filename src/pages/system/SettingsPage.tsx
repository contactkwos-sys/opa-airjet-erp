import { useCallback, useEffect, useState } from "react";
import { listRows, updateRow, type Row } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { settingsFormSchema, validateForm } from "@/lib/validation";
import { PIN_LOGIN_ROLES, ROLE_PIN_LABELS } from "@/lib/rolePins";
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

  useEffect(() => {
    void load();
  }, [load]);

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
      // Never write secrets from the browser
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
  }

  if (loading) return <LoadingState label="Loading settings…" />;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Company, factory loom counts, shifts and WhatsApp configuration."
      />

      {message ? <AlertBanner tone="info" title={message} /> : null}

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
          {(shifts.length ? shifts : [
            { id: "A", code: "A", name: "SHIFT A", start_time: "06:00", end_time: "14:00" },
            { id: "B", code: "B", name: "SHIFT B", start_time: "14:00", end_time: "22:00" },
            { id: "C", code: "C", name: "SHIFT C", start_time: "22:00", end_time: "06:00" },
          ]).map((s) => (
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
            {form.whatsapp_settings?.notify_ceo_on_visit === false
              ? "Off"
              : "On"}
          </li>
          <li>Secrets: configured on server</li>
        </ul>
      </section>

      {isSuperAdmin ? (
        <section className="panel page-card">
          <h3>Role PIN management</h3>
          <p>
            Rotate 4-digit role PINs. Hashes are stored server-side only — the
            new PIN is never saved in the browser after submit.
          </p>
          {pinMessage ? <AlertBanner tone="info" title={pinMessage} /> : null}
          {pinError ? <AlertBanner tone="danger" title={pinError} /> : null}
          <form className="form-grid" onSubmit={(e) => void handlePinRotate(e)}>
            <TextSelect
              label="Role"
              value={pinRole}
              onChange={(e) => setPinRole(e.target.value as OpaRole)}
            >
              {PIN_LOGIN_ROLES.map((r) => (
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
      ) : null}
    </>
  );
}
