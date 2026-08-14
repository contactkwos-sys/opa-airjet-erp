import { getSupabase } from "./supabase";
import type { Json } from "@/types/database";

export type AuditPayload = {
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  module: string;
  record_id?: string | null;
  old_value?: Json | null;
  new_value?: Json | null;
  ip_address?: string | null;
};

/** Inserts a row into opa_audit_logs. No-ops in Demo Mode. */
export async function writeAuditLog(payload: AuditPayload): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  const row = {
    user_id: payload.user_id ?? null,
    user_name: payload.user_name ?? null,
    action: payload.action,
    module: payload.module,
    record_id: payload.record_id ?? null,
    old_value: payload.old_value ?? null,
    new_value: payload.new_value ?? null,
    ip_address: payload.ip_address ?? null,
  };

  // Database Insert generics are partial; cast keeps client usable across tables.
  const { error } = await sb.from("opa_audit_logs").insert(row as never);

  if (error) {
    console.warn("[audit] failed to write log", error.message);
  }
}
