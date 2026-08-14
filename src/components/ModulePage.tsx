import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  deleteRow,
  insertRow,
  listRows,
  updateRow,
  type Row,
} from "@/lib/api";
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
  AlertBanner,
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
};

function fieldValueToForm(field: ModuleField, value: unknown): string {
  if (value === undefined || value === null) return "";
  if (field.type === "datetime-local") {
    const s = String(value);
    if (s.includes("T")) return s.slice(0, 16);
    return s;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function buildPayload(
  fields: ModuleField[],
  form: Record<string, string>,
  defaults?: Record<string, unknown>,
): Record<string, unknown> {
  const rawPayload: Record<string, unknown> = { ...(defaults ?? {}) };
  for (const f of fields) {
    const raw = form[f.name] ?? "";
    if (f.type === "number") {
      if (raw === "") {
        if (f.required) rawPayload[f.name] = 0;
        else delete rawPayload[f.name];
      } else {
        rawPayload[f.name] = Number(raw);
      }
    } else if (
      f.type === "select" &&
      (raw === "true" || raw === "false")
    ) {
      // boolean-looking selects (role permissions)
      const optValues = f.options?.map((o) => o.value) ?? [];
      if (optValues.includes("true") && optValues.includes("false")) {
        rawPayload[f.name] = raw === "true";
      } else {
        rawPayload[f.name] = raw;
      }
    } else if (raw === "" && !f.required) {
      delete rawPayload[f.name];
    } else {
      rawPayload[f.name] = raw;
    }
  }
  return rawPayload;
}

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
}: Props) {
  const { profile, demoMode, can } = useAuth();
  const canCreate =
    allowCreate ?? (!readOnly && can(moduleKey, "create"));
  const canEdit = !readOnly && can(moduleKey, "edit");
  const canDelete = !readOnly && can(moduleKey, "delete");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fromDemo, setFromDemo] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const demoRef = useRef(demoRows);
  demoRef.current = demoRows;

  const auditBase = useMemo(
    () => ({
      module: moduleKey,
      user_id: profile?.id,
      user_name: profile?.full_name,
    }),
    [moduleKey, profile?.id, profile?.full_name],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listRows(table, {
      select,
      orderBy,
      demoRows: demoRef.current,
    });
    setRows(result.data);
    setFromDemo(result.fromDemo);
    if (result.fromDemo) {
      setInfo(
        result.error ??
          "Showing demo data. Connect Supabase or apply migrations for live records.",
      );
    } else if (result.error) {
      setInfo(result.error);
    } else {
      setInfo(null);
    }
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
      initial[f.name] = fieldValueToForm(f, defaults[f.name]);
    }
    setMode("create");
    setEditingId(null);
    setForm(initial);
    setFieldErrors({});
    setOpen(true);
  }

  function openEdit(row: Row) {
    if (!canEdit) return;
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.name] = fieldValueToForm(f, row[f.name]);
    }
    setMode("edit");
    setEditingId(row.id);
    setForm(initial);
    setFieldErrors({});
    setOpen(true);
  }

  function validatePayload(rawPayload: Record<string, unknown>): boolean {
    if (schema) {
      const result = validateForm(schema, rawPayload);
      if (result.errors) {
        setFieldErrors(result.errors);
        return false;
      }
      return true;
    }
    const next: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !(form[f.name] ?? "").trim()) {
        next[f.name] = "Required";
      }
    }
    if (Object.keys(next).length) {
      setFieldErrors(next);
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "create" && !canCreate) return;
    if (mode === "edit" && !canEdit) return;
    setSaving(true);
    setFieldErrors({});

    const rawPayload = buildPayload(
      fields,
      form,
      mode === "create" ? createDefaults?.() : undefined,
    );

    if (!validatePayload(rawPayload)) {
      setSaving(false);
      return;
    }

    if (mode === "create") {
      const { data, error: err, fromDemo: local } = await insertRow(
        table,
        rawPayload,
        auditBase,
      );

      if (err && !local && !data) {
        setError(err);
        setSaving(false);
        return;
      }

      if ((local || fromDemo) && data) {
        setRows((r) => [data, ...r]);
        setFromDemo(true);
        if (err) setInfo(err);
        else
          setInfo(
            "Showing demo data. Connect Supabase or apply migrations for live records.",
          );
      } else {
        await load();
      }
    } else if (editingId) {
      const old = rows.find((r) => r.id === editingId);
      const { data, error: err, fromDemo: local } = await updateRow(
        table,
        editingId,
        rawPayload,
        { ...auditBase, old_value: old ?? null },
      );

      if (err && !local && !data) {
        setError(err);
        setSaving(false);
        return;
      }

      if (local || fromDemo) {
        setRows((prev) =>
          prev.map((r) =>
            r.id === editingId
              ? ({
                  ...r,
                  ...rawPayload,
                  ...(data ?? {}),
                  id: editingId,
                  updated_at: new Date().toISOString(),
                } as Row)
              : r,
          ),
        );
        setFromDemo(true);
        if (err) setInfo(err);
      } else {
        await load();
      }
    }

    setOpen(false);
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirmDelete || !canDelete) return;
    setDeleting(true);
    const { error: err, fromDemo: local } = await deleteRow(
      table,
      confirmDelete.id,
      { ...auditBase, old_value: confirmDelete },
    );

    if (err && !local) {
      setError(err);
      setDeleting(false);
      setConfirmDelete(null);
      return;
    }

    if (local || fromDemo) {
      setRows((prev) => prev.filter((r) => r.id !== confirmDelete.id));
      setFromDemo(true);
      if (err) setInfo(err);
    } else {
      await load();
    }
    setDeleting(false);
    setConfirmDelete(null);
  }

  const tableColumns = useMemo(() => {
    if (!canEdit && !canDelete) return columns;
    return [
      ...columns,
      {
        key: "_actions",
        header: "Actions",
        width: "9rem",
        render: (row: Row) => (
          <div className="row-actions" onClick={(e) => e.stopPropagation()}>
            {canEdit ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => openEdit(row)}
              >
                Edit
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(row)}
              >
                Delete
              </button>
            ) : null}
          </div>
        ),
      } satisfies Column<Row>,
    ];
  }, [columns, canEdit, canDelete]);

  const formId = `${mode}-${moduleKey}-${table}`;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        meta={
          demoMode || fromDemo || info ? (
            <span className="live-chip">
              {demoMode || fromDemo ? "Demo Mode" : info ?? "Live"}
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

      {(fromDemo || info) && !error ? (
        <AlertBanner
          tone="info"
          title={fromDemo || demoMode ? "Demo data" : "Notice"}
          onDismiss={() => setInfo(null)}
        >
          {info ??
            "Showing demo data. Connect Supabase or apply migrations for live records."}
        </AlertBanner>
      ) : null}

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
          <DataTable columns={tableColumns} rows={rows} rowKey={(r) => r.id} />
        ) : null}
      </section>

      <Modal
        open={open}
        title={mode === "create" ? `Create ${title}` : `Edit ${title}`}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id={formId} className="form-grid" onSubmit={handleSubmit}>
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
                type={
                  f.type === "datetime-local"
                    ? "datetime-local"
                    : (f.type ?? "text")
                }
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

      <Modal
        open={Boolean(confirmDelete)}
        title={`Delete ${title}`}
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p>
          Delete this record permanently? This cannot be undone
          {fromDemo || demoMode ? " in the current session" : ""}.
        </p>
      </Modal>
    </>
  );
}
