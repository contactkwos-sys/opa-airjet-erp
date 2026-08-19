import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { loginFormSchema } from "@/lib/validation";
import { isSupabaseConfigured } from "@/lib/env";
import { PIN_LOGIN_ROLES, ROLE_PIN_LABELS } from "@/lib/rolePins";
import type { OpaRole } from "@/types/database";
import { TextInput, TextSelect, AlertBanner, LoadingState } from "@/components/ui";

export default function LoginPage() {
  const { signIn, signInWithPin, session, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<OpaRole>("FACTORY_MANAGER");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
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

  async function onRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginFormSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setSubmitting(true);
    const result = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/");
  }

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

        {!showRecovery ? (
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
              {PIN_LOGIN_ROLES.map((r) => (
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
              {submitting ? "Signing in…" : "Enter your 4-digit role PIN"}
            </p>

            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                setShowRecovery(true);
                setError(null);
                setPin("");
              }}
            >
              Super Admin recovery (email)
            </button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={onRecoverySubmit}>
            <p className="muted recovery-hint">
              Email / password is for Super Admin recovery only. Day-to-day access uses role PIN.
            </p>
            <TextInput
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextInput
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting || !isSupabaseConfigured()}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                setShowRecovery(false);
                setError(null);
              }}
            >
              ← Back to PIN login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
