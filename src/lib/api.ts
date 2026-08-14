/**
 * Typed data-access helpers for opa_* tables.
 * Falls back to demo data when Demo Mode is on or tables are missing (PGRST205).
 */

import { getSupabase } from "./supabase";
import { isSupabaseConfigured } from "./env";
import { writeAuditLog, type AuditPayload } from "./audit";
import { getDemoRows } from "./demoData";

export type Row = Record<string, unknown> & { id: string };

export type ListOptions = {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, string | number | boolean | null>;
  limit?: number;
  /** When true (default), return demo rows if offline / table missing */
  demoFallback?: boolean;
  demoRows?: Row[];
};

export type MutateAudit = {
  module: string;
  user_id?: string | null;
  user_name?: string | null;
};

export class ApiError extends Error {
  readonly code?: string;
  readonly userMessage: string;

  constructor(userMessage: string, code?: string) {
    super(userMessage);
    this.name = "ApiError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string };
  if (e.code === "PGRST205" || e.code === "42P01") return true;
  const msg = `${e.message ?? ""} ${e.details ?? ""}`.toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

/** Map PostgREST / network errors to short user-facing copy. Never dump stacks. */
export function toUserError(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) return err.userMessage;
  if (!err || typeof err !== "object") return fallback;

  const e = err as { code?: string; message?: string; status?: number };
  if (isMissingTableError(err)) {
    return "This module is not connected yet. Showing demo data.";
  }
  if (e.code === "PGRST116") return "Record not found.";
  if (e.code === "23505") return "A record with this code already exists.";
  if (e.code === "23503") return "Related record is missing. Check linked fields.";
  if (e.code === "42501" || e.message?.toLowerCase().includes("permission")) {
    return "You do not have permission for this action.";
  }
  if (e.message?.toLowerCase().includes("jwt") || e.status === 401) {
    return "Your session expired. Please sign in again.";
  }
  if (e.message?.toLowerCase().includes("fetch") || e.message?.toLowerCase().includes("network")) {
    return "Network unavailable. Working with local demo data.";
  }
  // Never surface raw SQL / PostgREST dumps
  return fallback;
}

function resolveDemo(table: string, options?: ListOptions): Row[] {
  if (options?.demoRows) return options.demoRows.map((r) => ({ ...r }));
  return getDemoRows(table);
}

function isDemoModeClient(): boolean {
  return !isSupabaseConfigured() || !getSupabase();
}

export async function listRows<T extends Row = Row>(
  table: string,
  options: ListOptions = {},
): Promise<{ data: T[]; error: string | null; fromDemo: boolean }> {
  const demoFallback = options.demoFallback !== false;
  const sb = getSupabase();

  if (!sb || isDemoModeClient()) {
    return {
      data: resolveDemo(table, options) as T[],
      error: null,
      fromDemo: true,
    };
  }

  try {
    let q = sb.from(table as "opa_looms").select(options.select ?? "*");
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value === null) q = q.is(key, null);
        else q = q.eq(key, value as never);
      }
    }
    if (options.orderBy) {
      q = q.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? false,
      });
    }
    q = q.limit(options.limit ?? 200);

    const { data, error } = await q;
    if (error) throw error;

    if (!data?.length && demoFallback) {
      return {
        data: resolveDemo(table, options) as T[],
        error: null,
        fromDemo: true,
      };
    }

    return { data: (data as unknown as T[]) ?? [], error: null, fromDemo: false };
  } catch (err) {
    if (demoFallback && isMissingTableError(err)) {
      return {
        data: resolveDemo(table, options) as T[],
        error: toUserError(err),
        fromDemo: true,
      };
    }
    if (demoFallback) {
      return {
        data: resolveDemo(table, options) as T[],
        error: toUserError(err, "Could not load records"),
        fromDemo: true,
      };
    }
    return {
      data: [],
      error: toUserError(err, "Could not load records"),
      fromDemo: false,
    };
  }
}

export async function getById<T extends Row = Row>(
  table: string,
  id: string,
  options: { select?: string; demoFallback?: boolean; demoRows?: Row[] } = {},
): Promise<{ data: T | null; error: string | null; fromDemo: boolean }> {
  const demoFallback = options.demoFallback !== false;
  const sb = getSupabase();

  if (!sb) {
    const row =
      resolveDemo(table, options).find((r) => r.id === id) ?? null;
    return { data: row as T | null, error: null, fromDemo: true };
  }

  try {
    const { data, error } = await sb
      .from(table as "opa_looms")
      .select(options.select ?? "*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return { data: (data as unknown as T) ?? null, error: null, fromDemo: false };
  } catch (err) {
    if (demoFallback) {
      const row =
        resolveDemo(table, options).find((r) => r.id === id) ?? null;
      return {
        data: row as T | null,
        error: toUserError(err),
        fromDemo: true,
      };
    }
    return { data: null, error: toUserError(err), fromDemo: false };
  }
}

export async function insertRow<T extends Row = Row>(
  table: string,
  payload: Record<string, unknown>,
  audit?: MutateAudit,
): Promise<{ data: T | null; error: string | null; fromDemo: boolean }> {
  const sb = getSupabase();

  if (!sb) {
    const row = {
      id: crypto.randomUUID(),
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as T;
    return { data: row, error: null, fromDemo: true };
  }

  try {
    const { data, error } = await sb
      .from(table as "opa_looms")
      .insert(payload as never)
      .select()
      .single();
    if (error) throw error;

    if (audit) {
      await writeAuditLog({
        user_id: audit.user_id,
        user_name: audit.user_name,
        action: "CREATE",
        module: audit.module,
        record_id: (data as { id?: string })?.id,
        new_value: payload as AuditPayload["new_value"],
      });
    }

    return { data: data as unknown as T, error: null, fromDemo: false };
  } catch (err) {
    if (isMissingTableError(err)) {
      const row = {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as T;
      return {
        data: row,
        error: toUserError(err),
        fromDemo: true,
      };
    }
    return {
      data: null,
      error: toUserError(err, "Could not save record"),
      fromDemo: false,
    };
  }
}

export async function updateRow<T extends Row = Row>(
  table: string,
  id: string,
  payload: Record<string, unknown>,
  audit?: MutateAudit & { old_value?: unknown },
): Promise<{ data: T | null; error: string | null; fromDemo: boolean }> {
  const sb = getSupabase();

  if (!sb) {
    return {
      data: { id, ...payload } as T,
      error: null,
      fromDemo: true,
    };
  }

  try {
    const { data, error } = await sb
      .from(table as "opa_looms")
      .update(payload as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    if (audit) {
      await writeAuditLog({
        user_id: audit.user_id,
        user_name: audit.user_name,
        action: "UPDATE",
        module: audit.module,
        record_id: id,
        old_value: (audit.old_value ?? null) as AuditPayload["old_value"],
        new_value: payload as AuditPayload["new_value"],
      });
    }

    return { data: data as unknown as T, error: null, fromDemo: false };
  } catch (err) {
    if (isMissingTableError(err)) {
      return {
        data: { id, ...payload } as T,
        error: toUserError(err),
        fromDemo: true,
      };
    }
    return {
      data: null,
      error: toUserError(err, "Could not update record"),
      fromDemo: false,
    };
  }
}

/** Soft-deactivate when table has is_active; otherwise no-op with message. */
export async function softDeactivate(
  table: string,
  id: string,
  audit?: MutateAudit,
): Promise<{ error: string | null }> {
  const result = await updateRow(
    table,
    id,
    { is_active: false },
    audit ? { ...audit } : undefined,
  );
  if (result.error && !result.fromDemo) return { error: result.error };
  if (audit && result.fromDemo) {
    await writeAuditLog({
      user_id: audit.user_id,
      user_name: audit.user_name,
      action: "SOFT_DELETE",
      module: audit.module,
      record_id: id,
      new_value: { is_active: false },
    });
  }
  return { error: null };
}

export async function softActivate(
  table: string,
  id: string,
  audit?: MutateAudit,
): Promise<{ error: string | null }> {
  const result = await updateRow(
    table,
    id,
    { is_active: true },
    audit ? { ...audit } : undefined,
  );
  return { error: result.error && !result.fromDemo ? result.error : null };
}

/** Invoke a Supabase Edge Function; demo-safe when offline. */
export async function invokeEdgeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const sb = getSupabase();
  if (!sb) {
    return {
      data: { ok: true, demo: true, function: name } as T,
      error: null,
    };
  }
  try {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error) throw error;
    return { data: data as T, error: null };
  } catch (err) {
    return { data: null, error: toUserError(err, "Notification could not be sent") };
  }
}

export function downloadCsv(filename: string, rows: Row[], columns: string[]) {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    columns.join(","),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
