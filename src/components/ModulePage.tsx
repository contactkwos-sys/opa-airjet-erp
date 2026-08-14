import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { insertRow, listRows, type Row } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { validateForm } from "@/lib/validation";
import type { ModuleKey } from "@/lib/permissions";
import {
  PageHeader,
  DataTable,
  Modal,
  TextInput,
  TextSelect,
  TextTextarea,
  LoadingState,
  ErrorState,
  EmptyState,
  type Column,
} from "@/components/ui";

export type ModuleField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

type Props = {
  title: string;
  subtitle: string;
  table: string;
  moduleKey: ModuleKey;
  columns: Column<Row>[];
  fields: ModuleField[];
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  demoRows?: Row[];
  createDefaults?: () => Record<string, unknown>;
  schema?: z.ZodType<unknown>;
  /** Hide create when false; defaults to permission check */
  allowCreate?: boolean;
  readOnly?: boolean;
  /** Optional content below the page header (e.g. alert banners). */
  banner?: ReactNode | ((rows: Row[]) => ReactNode);
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
  demoRows,
  createDefaults,
  schema,
  allowCreate,
  readOnly = false,
  banner,
}: Props) {
  const { profile, demoMode, can } = useAuth();
  const canCreate =
    allowCreate ?? (!readOnly && can(moduleKey, "create"));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const demoRef = useRef(demoRows);
  demoRef.current = demoRows;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listRows(table, {
      select,
      orderBy,
      demoRows: demoRef.current,
    });
    setRows(result.data);
    if (result.error) setInfo(result.error);
    else if (result.fromDemo) setInfo(null);
    setLoading(false);
  }, [table, select, orderBy.column, orderBy.ascending]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    if (!canCreate) return;
    const defaults = createDefaults?.() ?? {};
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const v = defaults[f.name];
      initial[f.name] = v !== undefined && v !== null ? String(v) : "";
    }
    setForm(initial);
    setFieldErrors({});
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    setFieldErrors({});

    const rawPayload: Record<string, unknown> = { ...createDefaults?.() };
    for (const f of fields) {
      const raw = form[f.name] ?? "";
      if (f.type === "number") {
        if (raw === "") {
          if (f.required) rawPayload[f.name] = 0;
          else delete rawPayload[f.name];
        } else {
          rawPayload[f.name] = Number(raw);
        }
      } else if (raw === "" && !f.required) {
        delete rawPayload[f.name];
      } else {
        rawPayload[f.name] = raw;
      }
    }

    if (schema) {
      const result = validateForm(schema, rawPayload);
      if (result.errors) {
        setFieldErrors(result.errors);
        setSaving(false);
        return;
      }
    } else {
      for (const f of fields) {
        if (f.required && !(form[f.name] ?? "").trim()) {
          setFieldErrors((prev) => ({ ...prev, [f.name]: "Required" }));
          setSaving(false);
          return;
        }
      }
    }

    const { data, error: err, fromDemo } = await insertRow(table, rawPayload, {
      module: moduleKey,
      user_id: profile?.id,
      user_name: profile?.full_name,
    });

    if (err && !fromDemo && !data) {
      setError(err);
      setSaving(false);
      return;
    }

    if (fromDemo && data) {
      setRows((r) => [data, ...r]);
      if (err) setInfo(err);
    } else {
      await load();
    }
    setOpen(false);
    setSaving(false);
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        meta={
          demoMode || info ? (
            <span className="live-chip">
              {demoMode ? "Demo Mode" : info ?? "Live"}
            </span>
          ) : null
        }
        actions={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Create
            </button>
          ) : null
        }
      />

      {typeof banner === "function" ? banner(rows) : banner}

      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title={`No ${title.toLowerCase()} yet`}
            description={
              canCreate
                ? "Create the first record to get started."
                : "No records available for your role."
            }
            action={
              canCreate ? { label: "Create", onClick: openCreate } : undefined
            }
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
              form={`create-${moduleKey}-${table}`}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form
          id={`create-${moduleKey}-${table}`}
          className="form-grid"
          onSubmit={handleCreate}
        >
          {fields.map((f) => {
            if (f.type === "select" && f.options) {
              return (
                <TextSelect
                  key={f.name}
                  label={f.label}
                  required={f.required}
                  value={form[f.name] ?? ""}
                  error={fieldErrors[f.name]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </TextSelect>
              );
            }
            if (f.type === "textarea") {
              return (
                <TextTextarea
                  key={f.name}
                  label={f.label}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={form[f.name] ?? ""}
                  error={fieldErrors[f.name]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                  }
                />
              );
            }
            return (
              <TextInput
                key={f.name}
                label={f.label}
                type={f.type === "datetime-local" ? "datetime-local" : (f.type ?? "text")}
                required={f.required}
                placeholder={f.placeholder}
                value={form[f.name] ?? ""}
                error={fieldErrors[f.name]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                }
              />
            );
          })}
        </form>
      </Modal>
    </>
  );
}
