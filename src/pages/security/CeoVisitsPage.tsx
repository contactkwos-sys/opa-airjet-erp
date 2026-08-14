import { useCallback, useEffect, useMemo, useState } from "react";
import {
  insertRow,
  invokeEdgeFunction,
  listRows,
  updateRow,
  type Row,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ceoVisitFormSchema, validateForm } from "@/lib/validation";
import {
  PageHeader,
  DataTable,
  Modal,
  TextInput,
  TextTextarea,
  LoadingState,
  ErrorState,
  EmptyState,
  StatusBadge,
  type Column,
} from "@/components/ui";

const PIPELINE = ["PENDING", "APPROVED", "REJECTED", "RESCHEDULED", "COMPLETED"] as const;

export default function CeoVisitsPage() {
  const { profile, can, demoMode } = useAuth();
  const canCreate = can("security", "create");
  const canEdit = can("security", "edit");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifyId, setNotifyId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    request_number: `CEO-${today.replace(/-/g, "")}-NEW`,
    visitor_name: "",
    visitor_mobile: "",
    visitor_company: "",
    purpose: "",
    host_name: profile?.full_name ?? "",
    proposed_visit_at: `${today}T16:00`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listRows("opa_ceo_visit_requests", {
      orderBy: { column: "requested_at", ascending: false },
    });
    setRows(result.data);
    if (result.error && !result.fromDemo) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => rows.filter((r) => r.status === "PENDING").length,
    [rows],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    const payload = {
      ...form,
      proposed_visit_at: new Date(form.proposed_visit_at).toISOString(),
      status: "PENDING",
      requested_at: new Date().toISOString(),
    };
    const validated = validateForm(ceoVisitFormSchema, form);
    if (validated.errors) {
      setFieldErrors(validated.errors);
      setSaving(false);
      return;
    }
    const { data, error: err, fromDemo } = await insertRow(
      "opa_ceo_visit_requests",
      payload,
      {
        module: "security",
        user_id: profile?.id,
        user_name: profile?.full_name,
      },
    );
    if (err && !fromDemo && !data) {
      setError(err);
      setSaving(false);
      return;
    }
    if (fromDemo && data) setRows((r) => [data, ...r]);
    else await load();
    setOpen(false);
    setSaving(false);
  }

  async function setStatus(row: Row, status: string) {
    if (!canEdit) return;
    const { data, fromDemo } = await updateRow(
      "opa_ceo_visit_requests",
      row.id,
      { status, ceo_response_at: new Date().toISOString() },
      {
        module: "security",
        user_id: profile?.id,
        user_name: profile?.full_name,
        old_value: row,
      },
    );
    if (fromDemo && data) {
      setRows((list) =>
        list.map((r) => (r.id === row.id ? { ...r, ...data } : r)),
      );
    } else {
      await load();
    }
  }

  async function notifyWhatsApp(row: Row) {
    setNotifyId(row.id);
    const { error: err } = await invokeEdgeFunction("whatsapp-notify", {
      request_id: row.id,
      visitor_name: row.visitor_name,
      visitor_company: row.visitor_company,
      purpose: row.purpose,
      host_name: row.host_name,
      proposed_visit_at: row.proposed_visit_at,
    });
    if (err) setError(err);
    else setError(null);
    setNotifyId(null);
  }

  const columns: Column<Row>[] = [
    {
      key: "request_number",
      header: "Request #",
      render: (r) => String(r.request_number ?? "—"),
    },
    {
      key: "visitor_name",
      header: "Visitor",
      render: (r) => (
        <span>
          {String(r.visitor_name ?? "—")}
          <br />
          <small>{String(r.visitor_company ?? "")}</small>
        </span>
      ),
    },
    {
      key: "purpose",
      header: "Purpose",
      render: (r) => String(r.purpose ?? "—"),
    },
    {
      key: "proposed_visit_at",
      header: "Proposed",
      render: (r) =>
        r.proposed_visit_at
          ? new Date(String(r.proposed_visit_at)).toLocaleString("en-IN")
          : "—",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={String(r.status ?? "PENDING")} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          {canEdit
            ? PIPELINE.filter((s) => s !== r.status).slice(0, 3).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => void setStatus(r, s)}
                >
                  {s}
                </button>
              ))
            : null}
          {canCreate || canEdit ? (
            <button
              type="button"
              className="btn btn-primary btn-xs"
              disabled={notifyId === r.id}
              onClick={() => void notifyWhatsApp(r)}
            >
              {notifyId === r.id ? "Sending…" : "WhatsApp"}
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="CEO Visits"
        subtitle="Create visit requests, advance status, and notify CEO via WhatsApp."
        meta={
          <span className="live-chip">
            {demoMode ? "Demo Mode · " : ""}
            {pending} pending
          </span>
        }
        actions={
          canCreate ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFieldErrors({});
                setOpen(true);
              }}
            >
              New visit request
            </button>
          ) : null
        }
      />

      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title="No CEO visit requests"
            description="Create a request to start the approval pipeline."
            action={
              canCreate
                ? { label: "New visit request", onClick: () => setOpen(true) }
                : undefined
            }
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        ) : null}
      </section>

      <Modal
        open={open}
        title="Create CEO visit request"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="ceo-visit-create"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save & queue"}
            </button>
          </>
        }
      >
        <form id="ceo-visit-create" className="form-grid" onSubmit={handleCreate}>
          <TextInput
            label="Request number"
            required
            value={form.request_number}
            error={fieldErrors.request_number}
            onChange={(e) => setForm((f) => ({ ...f, request_number: e.target.value }))}
          />
          <TextInput
            label="Visitor name"
            required
            value={form.visitor_name}
            error={fieldErrors.visitor_name}
            onChange={(e) => setForm((f) => ({ ...f, visitor_name: e.target.value }))}
          />
          <TextInput
            label="Visitor mobile"
            value={form.visitor_mobile}
            error={fieldErrors.visitor_mobile}
            onChange={(e) => setForm((f) => ({ ...f, visitor_mobile: e.target.value }))}
          />
          <TextInput
            label="Company"
            value={form.visitor_company}
            onChange={(e) => setForm((f) => ({ ...f, visitor_company: e.target.value }))}
          />
          <TextInput
            label="Host name"
            value={form.host_name}
            onChange={(e) => setForm((f) => ({ ...f, host_name: e.target.value }))}
          />
          <TextInput
            label="Proposed visit"
            type="datetime-local"
            required
            value={form.proposed_visit_at}
            error={fieldErrors.proposed_visit_at}
            onChange={(e) => setForm((f) => ({ ...f, proposed_visit_at: e.target.value }))}
          />
          <TextTextarea
            label="Purpose"
            required
            value={form.purpose}
            error={fieldErrors.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </form>
      </Modal>
    </>
  );
}
