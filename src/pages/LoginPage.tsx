import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";
import { EMPLOYEE_PIN_LOGIN_ROLES, ROLE_PIN_LABELS } from "@/lib/rolePins";
import type { OpaRole } from "@/types/database";
import { TextSelect, AlertBanner, LoadingState } from "@/components/ui";
import { AppFooter } from "@/components/layout/AppFooter";

type DirectoryEmployee = {
  id: string;
  role: OpaRole;
  display_name: string;
};

function isLoginRole(value: string | null): value is OpaRole {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  return (EMPLOYEE_PIN_LOGIN_ROLES as string[]).includes(normalized);
}

export default function LoginPage() {
  const { signInWithPin, session, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepRoleRaw = searchParams.get("role");
  const deepRole = deepRoleRaw?.trim().toUpperCase() ?? null;
  const deepEmployeeId = searchParams.get("e")?.trim() ?? "";

  const [role, setRole] = useState<OpaRole>(() =>
    isLoginRole(deepRole) ? (deepRole as OpaRole) : "FACTORY_MANAGER",
  );
  const [employeeId, setEmployeeId] = useState(deepEmployeeId);
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const deepLinkApplied = useRef(false);

  const loadEmployees = useCallback(async (selectedRole: OpaRole) => {
    setDirectoryError(null);
    const sb = getSupabase();
    if (!sb) {
      setEmployees([]);
      return;
    }
    const { data, error: qError } = await sb
      .from("opa_pin_employee_directory")
      .select("id, role, display_name")
      .eq("role", selectedRole)
      .order("display_name", { ascending: true });
    if (qError) {
      setDirectoryError(qError.message);
      setEmployees([]);
      setEmployeeId("");
      return;
    }
    const rows = (data ?? []) as DirectoryEmployee[];
    setEmployees(rows);

    setEmployeeId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      if (
        !deepLinkApplied.current &&
        deepEmployeeId &&
        rows.some((r) => r.id === deepEmployeeId)
      ) {
        deepLinkApplied.current = true;
        return deepEmployeeId;
      }
      return rows[0]?.id ?? "";
    });
  }, [deepEmployeeId]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void loadEmployees(role);
  }, [role, loadEmployees]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const hideNamePicker = employees.length <= 1;

  function pushDigit(d: string) {
    if (inFlight.current || !employeeId) return;
    setError(null);
    setPin((prev) => (prev.length >= 4 ? prev : `${prev}${d}`));
  }

  function clearPin() {
    if (inFlight.current) return;
    setPin("");
    setError(null);
  }

  useEffect(() => {
    if (
      session ||
      loading ||
      pin.length !== 4 ||
      inFlight.current ||
      !employeeId
    ) {
      return;
    }
    let cancelled = false;
    async function autoSubmit() {
      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      const result = await signInWithPin(role, pin, employeeId);
      if (cancelled) {
        inFlight.current = false;
        return;
      }
      setSubmitting(false);
      inFlight.current = false;
      if (result.error) {
        setError(result.error);
        setPin("");
        return;
      }
      navigate("/");
    }
    void autoSubmit();
    return () => {
      cancelled = true;
    };
  }, [pin, role, employeeId, signInWithPin, navigate, session, loading]);

  if (loading) {
    return <LoadingState label="Starting OPA ERP…" />;
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="brand login-brand">
          <div className="brand-mark" aria-hidden>
            OPA
          </div>
          <h1>OPA Group of India</h1>
          <p>Air Jet Loom ERP</p>
        </div>

        {!isSupabaseConfigured() ? (
          <AlertBanner tone="warning" title="Configuration required">
            Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to
            enable sign-in.
          </AlertBanner>
        ) : null}

        {deepEmployeeId && selectedEmployee ? (
          <p className="muted pin-hint employee-link-banner">
            Personal login link for <strong>{selectedEmployee.display_name}</strong>
            {" · "}
            {ROLE_PIN_LABELS[role]}
          </p>
        ) : null}

        <form
          className="form-grid pin-login"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <TextSelect
            label="Role"
            value={role}
            disabled={!isSupabaseConfigured() || submitting}
            onChange={(e) => {
              deepLinkApplied.current = true;
              setRole(e.target.value as OpaRole);
              setPin("");
              setError(null);
            }}
          >
            {EMPLOYEE_PIN_LOGIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_PIN_LABELS[r]}
              </option>
            ))}
          </TextSelect>

          {!hideNamePicker ? (
            <TextSelect
              label="Name"
              value={employeeId}
              disabled={!isSupabaseConfigured() || submitting || employees.length === 0}
              onChange={(e) => {
                deepLinkApplied.current = true;
                setEmployeeId(e.target.value);
                setPin("");
                setError(null);
              }}
            >
              {employees.length === 0 ? (
                <option value="">No employees configured</option>
              ) : (
                employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.display_name}
                  </option>
                ))
              )}
            </TextSelect>
          ) : selectedEmployee ? (
            <p className="muted pin-hint">
              Signing in as <strong>{selectedEmployee.display_name}</strong>
            </p>
          ) : null}

          {directoryError ? (
            <p className="form-error">{directoryError}</p>
          ) : employees.length === 0 && isSupabaseConfigured() ? (
            <p className="muted pin-hint">
              No named logins for {ROLE_PIN_LABELS[role]} yet. Ask CEO or Director to
              add employees.
            </p>
          ) : null}

          <div className="pin-display" aria-live="polite" aria-label="PIN entry">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`pin-dot${pin.length > i ? " filled" : ""}`} />
            ))}
          </div>

          <div className="pin-pad" role="group" aria-label="PIN keypad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((key) => (
              <button
                key={key}
                type="button"
                className="pin-key"
                disabled={
                  !isSupabaseConfigured() || submitting || !employeeId
                }
                onClick={() => {
                  if (key === "C") clearPin();
                  else if (key === "⌫") {
                    if (!inFlight.current) setPin((p) => p.slice(0, -1));
                  } else pushDigit(key);
                }}
              >
                {key}
              </button>
            ))}
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <p className="muted pin-hint">
            {submitting
              ? "Signing in…"
              : selectedEmployee
                ? `Enter PIN for ${selectedEmployee.display_name}`
                : "Select a name, then enter your 4-digit PIN"}
          </p>
        </form>
      </div>
      <AppFooter />
    </div>
  );
}
