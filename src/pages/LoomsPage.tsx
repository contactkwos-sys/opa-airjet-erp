import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { buildDemoLooms } from "@/lib/demoData";
import { listRows, toUserError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { LoomStatus, LoomType, OpaLoom } from "@/types/database";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Modal,
  TextInput,
  TextSelect,
  LoadingState,
  ErrorState,
  EmptyState,
  AlertBanner,
  type Column,
} from "@/components/ui";

const STATUSES: Array<LoomStatus | "ALL"> = [
  "ALL",
  "RUNNING",
  "STOPPED",
  "BREAKDOWN",
  "MAINTENANCE",
  "IDLE",
];

export default function LoomsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LoomStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<LoomType | "ALL">("ALL");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    loom_number: "",
    loom_type: "PLAIN" as LoomType,
    status: "IDLE" as LoomStatus,
    location: "Shed A",
    make: "Toyota",
    model: "",
  });

  const [fromDemo, setFromDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listRows("opa_looms", {
      orderBy: { column: "loom_number", ascending: true },
      limit: 200,
      demoRows: buildDemoLooms() as unknown as Array<{ id: string } & Record<string, unknown>>,
    });
    setLooms((result.data.length ? result.data : buildDemoLooms()) as OpaLoom[]);
    setFromDemo(result.fromDemo);
    // Missing tables → demo data only (no blocking error banner)
    if (result.error && !result.fromDemo) {
      setError(toUserError(result.error, "Failed to load looms"));
    } else {
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return looms.filter((l) => {
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && l.loom_type !== typeFilter) return false;
      return true;
    });
  }, [looms, statusFilter, typeFilter]);

  const columns: Column<OpaLoom>[] = [
    {
      key: "loom_number",
      header: "Loom",
      render: (r) => <Link to={`/looms/${r.id}`}>{r.loom_number}</Link>,
    },
    { key: "location", header: "Location", render: (r) => r.location ?? "—" },
    { key: "loom_type", header: "Type", render: (r) => r.loom_type },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "article",
      header: "Article",
      render: (r) => r.current_article ?? "—",
    },
    { key: "rpm", header: "RPM", render: (r) => r.rpm ?? "—" },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const sb = getSupabase();
    const payload = { ...form, is_active: true };
    if (!sb) {
      setLooms((prev) => [
        {
          id: crypto.randomUUID(),
          ...payload,
          serial_number: null,
          installation_date: null,
          width: null,
          reed: null,
          pick: null,
          rpm: null,
          motor: null,
          controller: null,
          dobby_unit: null,
          electronic_components: [],
          current_article: null,
          current_quality: null,
          current_operator_id: null,
          current_shift_id: null,
          notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setOpen(false);
      setSaving(false);
      return;
    }
    try {
      const { data, error: err } = await sb
        .from("opa_looms")
        .insert(payload as never)
        .select()
        .single();
      if (err) throw err;
      await writeAuditLog({
        user_id: profile?.id,
        user_name: profile?.full_name,
        action: "CREATE",
        module: "looms",
        record_id: (data as OpaLoom).id,
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
        title="Looms"
        subtitle="Monitor all 72 air jet looms across Shed A & B."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Add loom
          </button>
        }
      />

      {fromDemo ? (
        <AlertBanner tone="info" title="Demo data">
          Live loom tables are not connected yet. Showing the seeded 72-loom preview.
        </AlertBanner>
      ) : null}

      <section className="panel table-panel">
        <div className="filters" role="tablist" aria-label="Filter by status">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={statusFilter === s ? "active" : undefined}
              onClick={() => setStatusFilter(s)}
            >
              {s === "ALL" ? "All status" : s.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="filters" role="tablist" aria-label="Filter by type">
          {(["ALL", "DOBBY", "PLAIN"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={typeFilter === t ? "active" : undefined}
              onClick={() => setTypeFilter(t)}
            >
              {t === "ALL" ? "All types" : t}
            </button>
          ))}
        </div>

        {loading ? <LoadingState label="Loading looms…" /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState title="No looms match filters" action={{ label: "Reset", onClick: () => { setStatusFilter("ALL"); setTypeFilter("ALL"); } }} />
        ) : null}
        {!loading && filtered.length > 0 ? (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            pageSize={18}
            onRowClick={(r) => navigate(`/looms/${r.id}`)}
          />
        ) : null}
      </section>

      <Modal
        open={open}
        title="Add loom"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="create-loom" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="create-loom" className="form-grid" onSubmit={handleCreate}>
          <TextInput
            label="Loom number"
            required
            value={form.loom_number}
            onChange={(e) => setForm((f) => ({ ...f, loom_number: e.target.value }))}
          />
          <TextSelect
            label="Type"
            value={form.loom_type}
            onChange={(e) => setForm((f) => ({ ...f, loom_type: e.target.value as LoomType }))}
          >
            <option value="DOBBY">DOBBY</option>
            <option value="PLAIN">PLAIN</option>
          </TextSelect>
          <TextSelect
            label="Status"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LoomStatus }))}
          >
            {STATUSES.filter((s) => s !== "ALL").map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </TextSelect>
          <TextInput
            label="Location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
          <TextInput
            label="Make"
            value={form.make}
            onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
          />
          <TextInput
            label="Model"
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          />
        </form>
      </Modal>
    </>
  );
}
