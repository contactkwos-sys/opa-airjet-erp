import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";
import { EMPLOYEE_PIN_LOGIN_ROLES, ROLE_PIN_LABELS } from "@/lib/rolePins";
import type { OpaRole } from "@/types/database";
import { TextSelect, AlertBanner, LoadingState } from "@/components/ui";
import { AppFooter } from "@/components/layout/AppFooter";

export default function LoginPage() {
  const { signInWithPin, session, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<OpaRole>("FACTORY_MANAGER");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  function pushDigit(d: string) {
    if (inFlight.current) return;
    setError(null);
    setPin((prev) => (prev.length >= 4 ? prev : `${prev}${d}`));
  }

  function clearPin() {
    if (inFlight.current) return;
    setPin("");
    setError(null);
  }

  // Hooks must run unconditionally — never return before this effect.
  useEffect(() => {
    if (session || loading || pin.length !== 4 || inFlight.current) return;
    let cancelled = false;
    async function autoSubmit() {
      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      const result = await signInWithPin(role, pin);
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
  }, [pin, role, signInWithPin, navigate, session, loading]);

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
          <AlertBanner
            tone="warning"
            title="Configuration required"
            children="Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in."
          />
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
                disabled={!isSupabaseConfigured() || submitting}
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
            {submitting ? "Signing in…" : "Enter your 4-digit PIN"}
          </p>
        </form>
      </div>
      <AppFooter />
    </div>
  );
}
