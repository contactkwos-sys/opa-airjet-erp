import { useState } from "react";
import type { AppRole } from "../../types/security";
import { useAuth, ROLE_LABELS } from "../../lib/auth";
import { isSupabaseConfigured } from "../../lib/supabase";

const LOCAL_ROLES: AppRole[] = [
  "SECURITY_HEAD",
  "SECURITY_GUARD",
  "CEO",
  "DIRECTOR",
  "FACTORY_MANAGER",
];

export function LoginPage() {
  const { mode, loginLocal, loginSupabase } = useAuth();
  const [role, setRole] = useState<AppRole>("SECURITY_HEAD");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSupabaseLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await loginSupabase(email, password);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand-mark">OPA</div>
        <h1>OPA Group of India</h1>
        <p className="login-sub">Air Jet Loom ERP · Security Gate</p>

        {mode === "local" || !isSupabaseConfigured ? (
          <>
            <div className="banner warn">
              Supabase is not configured. Local role entry is for gated testing only — configure
              Supabase for production.
            </div>
            <label className="field">
              <span>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
                {LOCAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Display name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
            </label>
            <button type="button" className="btn primary block" onClick={() => loginLocal(role, name)}>
              Enter Security Module
            </button>
          </>
        ) : (
          <form onSubmit={(e) => void onSupabaseLogin(e)}>
            <label className="field">
              <span>Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <div className="banner error">{error}</div>}
            <button type="submit" className="btn primary block" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
