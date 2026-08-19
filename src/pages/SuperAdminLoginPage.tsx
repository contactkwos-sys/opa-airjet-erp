import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";
import { AlertBanner, LoadingState, TextInput } from "@/components/ui";
import { AppFooter } from "@/components/layout/AppFooter";

/**
 * Hidden Super Admin PIN entry — not linked from the public login UI.
 * Route: /super-login
 */
export default function SuperAdminLoginPage() {
  const { signInWithPin, signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEmailRecovery, setShowEmailRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  useEffect(() => {
    if (session || loading || pin.length !== 4 || inFlight.current || showEmailRecovery) {
      return;
    }
    let cancelled = false;
    async function autoSubmit() {
      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      const result = await signInWithPin("SUPER_ADMIN", pin);
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
      navigate("/settings");
    }
    void autoSubmit();
    return () => {
      cancelled = true;
    };
  }, [pin, signInWithPin, navigate, session, loading, showEmailRecovery]);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/settings");
  }

  if (loading) {
    return <LoadingState label="Starting OPA ERP…" />;
  }

  if (session) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="login-page">
      <div className="login-card panel">
        <div className="brand login-brand">
          <div className="brand-mark" aria-hidden>
            OPA
          </div>
          <h1>Super Admin</h1>
          <p>Restricted access · PIN required</p>
        </div>

        {!isSupabaseConfigured() ? (
          <AlertBanner
            tone="warning"
            title="Configuration required"
            children="Supabase is not configured."
          />
        ) : null}

        {!showEmailRecovery ? (
          <form
            className="form-grid pin-login"
            onSubmit={(e) => e.preventDefault()}
          >
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
              {submitting ? "Signing in…" : "Enter Super Admin 4-digit PIN"}
            </p>

            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                setShowEmailRecovery(true);
                setError(null);
                setPin("");
              }}
            >
              Email recovery
            </button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={(e) => void onEmailSubmit(e)}>
            <p className="muted recovery-hint">
              Email / password recovery for Super Admin only.
            </p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
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
                setShowEmailRecovery(false);
                setError(null);
              }}
            >
              ← Back to PIN
            </button>
          </form>
        )}
      </div>
      <AppFooter />
    </div>
  );
}
