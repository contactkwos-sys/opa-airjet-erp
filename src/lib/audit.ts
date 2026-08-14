import type { Profile } from "../types/security";
import { isSupabaseConfigured, supabase } from "./supabase";
import { nowISO, uid, updateStore } from "./localStore";

export async function writeAudit(params: {
  user: Profile | null;
  action: string;
  module: string;
  recordId?: string | null;
  oldData?: unknown;
  newData?: unknown;
}): Promise<void> {
  const row = {
    id: uid("aud"),
    user_id: params.user?.id ?? null,
    action: params.action,
    module: params.module,
    record_id: params.recordId ?? null,
    old_data: params.oldData ?? null,
    new_data: params.newData ?? null,
    ip_address: null,
    created_at: nowISO(),
  };

  if (isSupabaseConfigured && supabase) {
    await supabase.from("audit_logs").insert({
      user_id: row.user_id,
      action: row.action,
      module: row.module,
      record_id: row.record_id,
      old_data: row.old_data,
      new_data: row.new_data,
      ip_address: row.ip_address,
    });
    return;
  }

  updateStore((s) => {
    s.audit_logs.unshift(row);
  });
}

export async function pushNotification(params: {
  notification_type: string;
  reference_id?: string | null;
  recipient_role?: string | null;
  recipient_user_id?: string | null;
  message: string;
}): Promise<void> {
  const row = {
    id: uid("ntf"),
    notification_type: params.notification_type,
    reference_id: params.reference_id ?? null,
    recipient_role: params.recipient_role ?? null,
    recipient_user_id: params.recipient_user_id ?? null,
    message: params.message,
    is_read: false,
    created_at: nowISO(),
  };

  if (isSupabaseConfigured && supabase) {
    await supabase.from("security_notifications").insert({
      notification_type: row.notification_type,
      reference_id: row.reference_id,
      recipient_role: row.recipient_role,
      recipient_user_id: row.recipient_user_id,
      message: row.message,
      is_read: false,
    });
    return;
  }

  updateStore((s) => {
    s.security_notifications.unshift(row);
  });
}
