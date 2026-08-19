import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabase } from "@/lib/supabase";
import { AlertBanner, LoadingState, TextSelect } from "@/components/ui";
import { AppFooter } from "@/components/layout/AppFooter";

type DirectoryEmployee = {
  id: string;
  role: "COMPANY_ADMIN";
  display_name: string;
};

/**
 * Tier 1 — Company Admin (CEO/Director).
 * Hidden route: /super-login (alias /admin). Named logins only — no email recovery.
 */
export default function SuperAdminLoginPage() {
  const { signInWithPin, session, loading } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const loadEmployees = useCallback(async () => {
    setDirectoryError(null);
    const sb = getSupabase();
    if (!sb) {
      setEmployees([]);
      return;
    }
    const { data, error: qError } = await sb
      .from("opa_pin_employee_directory")
      .select("id, role, display_name")
      .eq("role", "COMPANY_ADMIN")
      .order("display_name", { ascending: true });
    if (qError) {
      setDirectoryError(qError.message);
      setEmployees([]);
      setEmployeeId("");
      return;
    }
    const rows = (data ?? []) as DirectoryEmployee[];
    setEmployees(rows);
    setEmployeeId((prev) =>
      rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? ""),
    );
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void loadEmployees();
  }, [loadEmployees]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

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
      const result = await signInWithPin("COMPANY_ADMIN", pin, employeeId);
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
      navigate("/admin/employee-overview");
    }
    void autoSubmit();
    return () => {
      cancelled = true;
    };
  }, [pin, employeeId, signInWithPin, navigate, session, loading]);

  if (loading) {
    return <LoadingState label="Starting OPA ERP…" />;
  }

  if (session) {
    return <Navigate to="/admin/employee-overview" replace />;
  }

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="brand login-brand">
          <div className="brand-mark" aria-hidden>
            OPA
          </div>
          <h1>Company Admin</h1>
          <p>CEO / Director · employee &amp; PIN management</p>
        </div>

        {!isSupabaseConfigured() ? (
          <AlertBanner tone="warning" title="Configuration required">
            Supabase is not configured.
          </AlertBanner>
        ) : null}

        {directoryError ? (
          <AlertBanner tone="danger" title="Could not load admins">
            {directoryError}
          </AlertBanner>
        ) : null}

        <form
          className="form-grid pin-login"
          onSubmit={(e) => e.preventDefault()}
        >
          <TextSelect
            label="Admin"
            value={employeeId}
            disabled={!isSupabaseConfigured() || submitting || employees.length === 0}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setPin("");
              setError(null);
            }}
          >
            {employees.length === 0 ? (
              <option value="">No Company Admins configured</option>
            ) : (
              employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.display_name}
                </option>
              ))
            )}
          </TextSelect>

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
                : "Select an admin, then enter PIN"}
          </p>
        </form>
      </div>
      <AppFooter />
    </div>
  );
}
