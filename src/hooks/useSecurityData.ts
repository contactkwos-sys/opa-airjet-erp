import { useCallback, useEffect, useState } from "react";
import type { SecurityDashboardStats } from "../types/security";
import { getDashboardStats } from "../services/securityService";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { subscribeStore } from "../lib/localStore";

export function useDashboardStats() {
  const [stats, setStats] = useState<SecurityDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!isSupabaseConfigured) {
      return subscribeStore(() => {
        void refresh();
      });
    }
    if (!supabase) return;
    const channel = supabase
      .channel("security-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitor_requests" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ceo_visit_requests" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visitor_entries" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "security_notifications" },
        () => void refresh()
      )
      .subscribe();
    return () => {
      void supabase!.removeChannel(channel);
    };
  }, [refresh]);

  return { stats, loading, error, refresh };
}

export function useLocalRefresh(cb: () => void) {
  useEffect(() => {
    if (isSupabaseConfigured) return;
    return subscribeStore(cb);
  }, [cb]);
}
