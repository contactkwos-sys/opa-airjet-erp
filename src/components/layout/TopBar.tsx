import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/env";

function currentShift(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "Shift A";
  if (h >= 14 && h < 22) return "Shift B";
  return "Shift C";
}

type Props = {
  onMenuToggle: () => void;
  menuOpen: boolean;
};

export function TopBar({ onMenuToggle, menuOpen }: Props) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());
  const live = isSupabaseConfigured();

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={onMenuToggle}
        >
          <span className="hamburger" aria-hidden />
        </button>
        <div className="topbar-brand">
          <strong>OPA Air Jet ERP</strong>
          <span className="topbar-plant">Plant: OPA Group of India</span>
        </div>
      </div>

      <div className="topbar-center">
        <span className={`live-badge${live ? " live" : " offline"}`}>
          <span className="live-dot" aria-hidden />
          {live ? "LIVE" : "OFFLINE"}
        </span>
        <span className="topbar-datetime">
          {format(now, "dd MMM yyyy · hh:mm a")}
        </span>
        <span className="topbar-shift">{currentShift()}</span>
      </div>

      <div className="topbar-right">
        <Link to="/notifications" className="topbar-icon-btn" aria-label="Notifications">
          <span className="icon-bell" aria-hidden />
        </Link>
        <Link to="/search" className="topbar-icon-btn" aria-label="Search">
          <span className="icon-search" aria-hidden />
        </Link>
        <div className="topbar-user">
          <span className="topbar-username">{profile?.full_name ?? "User"}</span>
          <span className="topbar-role">{role?.replace(/_/g, " ") ?? "—"}</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm topbar-logout"
          onClick={async () => {
            await signOut();
            navigate("/login");
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
