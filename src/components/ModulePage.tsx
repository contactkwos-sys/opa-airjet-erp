import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  DataTable,
  Modal,
  TextInput,
  LoadingState,
  ErrorState,
  EmptyState,
  type Column,
} from "@/components/ui";

export type ModuleField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "email" | string;
  required?: boolean;
  placeholder?: string;
};

type Row = Record<string, unknown> & { id: string };

type Props = {
  title: string;
  subtitle: string;
  table: string;
  moduleKey: string;
  columns: Column<Row>[];
  fields: ModuleField[];
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  demoRows?: Row[];
  createDefaults?: () => Record<string, unknown>;
};

export function ModulePage({
  title,
  subtitle,
  table,
  moduleKey,
  columns,
  fields,
  select = "*",
  orderBy = { column: "created_at", ascending: false },
  demoRows = [],
  createDefaults,
}: Props) {
  const { profile, demoMode } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const demoRef = useRef(demoRows);
  demoRef.current = demoRows;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sb = getSupabase();
    if (!sb) {
      setRows(demoRef.current);
      setLoading(false);
      return;
    }
    try {
      let q = sb.from(table as "opa_looms").select(select);
      q = q.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      const { data, error: err } = await q.limit(200);
      if (err) throw err;
      setRows((data as unknown as Row[]) ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      setRows(demoRef.current);
    } finally {
      setLoading(false);
    }
  }, [table, select, orderBy.column, orderBy.ascending]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    const defaults = createDefaults?.() ?? {};
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const v = defaults[f.name];
      initial[f.name] = v !== undefined && v !== null ? String(v) : "";
    }
    setForm(initial);
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = { ...createDefaults?.() };
    for (const f of fields) {
      const raw = form[f.name] ?? "";
      if (f.type === "number") {
        payload[f.name] = raw === "" ? null : Number(raw);
      } else {
        payload[f.name] = raw;
      }
    }

    const sb = getSupabase();
    if (!sb) {
      const id = crypto.randomUUID();
      setRows((r) => [{ id, ...payload } as Row, ...r]);
      setOpen(false);
      setSaving(false);
      return;
    }

    try {
      const { data, error: err } = await sb
        .from(table as "opa_looms")
        .insert(payload as never)
        .select()
        .single();
      if (err) throw err;
      await writeAuditLog({
        user_id: profile?.id,
        user_name: profile?.full_name,
        action: "CREATE",
        module: moduleKey,
        record_id: (data as { id?: string })?.id,
        new_value: payload as never,
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        meta={
          demoMode ? (
            <span className="live-chip">Demo data when offline</span>
          ) : null
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Create
          </button>
        }
      />

      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title={`No ${title.toLowerCase()} yet`}
            description="Create the first record to get started."
            action={{ label: "Create", onClick: openCreate }}
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        ) : null}
      </section>

      <Modal
        open={open}
        title={`Create ${title}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form={`create-${moduleKey}`}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id={`create-${moduleKey}`} className="form-grid" onSubmit={handleCreate}>
          {fields.map((f) => (
            <TextInput
              key={f.name}
              label={f.label}
              type={f.type ?? "text"}
              required={f.required}
              placeholder={f.placeholder}
              value={form[f.name] ?? ""}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
              }
            />
          ))}
        </form>
      </Modal>
    </>
  );
}
