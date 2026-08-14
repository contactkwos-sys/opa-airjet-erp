import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { loginFormSchema } from "@/lib/validation";
import { isSupabaseConfigured } from "@/lib/env";
import { TextInput, AlertBanner } from "@/components/ui";

export default function LoginPage() {
  const { signIn, session, demoMode, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
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

        {!isSupabaseConfigured() || demoMode ? (
          <AlertBanner
            tone="warning"
            title="Demo Mode"
            children="Supabase anon key not configured. Sign-in will open the SUPER_ADMIN preview."
          />
        ) : null}

        <form className="form-grid" onSubmit={onSubmit}>
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
          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {!isSupabaseConfigured() ? (
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={async () => {
              await signIn("demo@opa.local", "demo");
              navigate("/");
            }}
          >
            Continue in Demo Mode
          </button>
        ) : null}
      </div>
    </div>
  );
}
