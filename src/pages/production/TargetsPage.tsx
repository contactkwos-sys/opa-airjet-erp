import { useCallback, useEffect, useMemo, useState } from "react";
import { insertRow, listRows, type Row } from "@/lib/api";
import { getDemoRows } from "@/lib/demoData";
import { displayLoomNumber } from "@/lib/loomCodes";
import { achievementPct, achievementRag } from "@/lib/productionCalc";
import { useAuth } from "@/context/AuthContext";
import { targetFormSchema, validateForm } from "@/lib/validation";
import type { OpaLoom } from "@/types/database";
import {
  PageHeader,
  StatCard,
  DataTable,
  Modal,
  TextInput,
  TextSelect,
  TextTextarea,
  LoadingState,
  ErrorState,
  EmptyState,
  AchievementIndicator,
  AlertBanner,
  type Column,
} from "@/components/ui";

type TargetRow = Row & {
  target_type?: string;
  target_date?: string;
  loom_type?: string | null;
  loom_id?: string | null;
  target_meter?: number;
  target_kg?: number | null;
  actual_meter?: number | null;
  actual_kg?: number | null;
  remarks?: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function TargetsPage() {
  const { profile, demoMode, can } = useAuth();
  const canCreate = can("production", "create");
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    target_type: "DAILY",
    target_date: today,
    loom_type: "",
    loom_id: "",
    target_meter: "0",
    target_kg: "0",
    remarks: "",
  });

  const loomMap = useMemo(() => {
    const m = new Map<string, OpaLoom>();
    for (const l of looms) m.set(l.id, l);
    return m;
  }, [looms]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [targets, loomRows] = await Promise.all([
      listRows<TargetRow>("opa_production_targets", {
        orderBy: { column: "target_date", ascending: false },
        demoRows: getDemoRows("opa_production_targets"),
      }),
      listRows<OpaLoom & Row>("opa_looms", {
        orderBy: { column: "loom_number", ascending: true },
        demoRows: getDemoRows("opa_looms"),
      }),
    ]);
    setRows(targets.data);
    setLooms(loomRows.data as OpaLoom[]);
    if (targets.error) setInfo(targets.error);
    else if (targets.fromDemo) setInfo(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const target = rows.reduce((s, r) => s + num(r.target_meter), 0);
    const actual = rows.reduce((s, r) => s + num(r.actual_meter), 0);
    const balance = Math.max(0, target - actual);
    const achievement = achievementPct(actual, target);
    return { target, actual, balance, achievement, rag: achievementRag(achievement) };
  }, [rows]);

  const columns: Column<TargetRow>[] = useMemo(
    () => [
      {
        key: "target_type",
        header: "Type",
        render: (r) => String(r.target_type ?? "—"),
      },
      {
        key: "target_date",
        header: "Date / Month",
        render: (r) => String(r.target_date ?? "—"),
      },
      {
        key: "loom_type",
        header: "Loom type",
        render: (r) => String(r.loom_type ?? "—"),
      },
      {
        key: "loom_id",
        header: "Loom",
        render: (r) => {
          if (!r.loom_id) return "—";
          const loom = loomMap.get(String(r.loom_id));
          return loom ? displayLoomNumber(loom) : String(r.loom_id);
        },
      },
      {
        key: "target_meter",
        header: "Target (M)",
        render: (r) => num(r.target_meter).toLocaleString("en-IN"),
      },
      {
        key: "actual_meter",
        header: "Actual (M)",
        render: (r) => num(r.actual_meter).toLocaleString("en-IN"),
      },
      {
        key: "target_kg",
        header: "Target (Kg)",
        render: (r) => num(r.target_kg).toLocaleString("en-IN"),
      },
      {
        key: "achievement",
        header: "Achievement",
        render: (r) => {
          const pct = achievementPct(num(r.actual_meter), num(r.target_meter));
          const rag = achievementRag(pct);
          return (
            <AchievementIndicator
              level={rag}
              value={`${pct.toFixed(1)}%`}
              label={rag === "green" ? "On track" : rag === "amber" ? "Near" : "Below"}
            />
          );
        },
      },
      {
        key: "remarks",
        header: "Remarks",
        render: (r) => String(r.remarks ?? "—"),
      },
    ],
    [loomMap],
  );

  const filteredLooms = useMemo(() => {
    if (!form.loom_type) return looms;
    return looms.filter((l) => l.loom_type === form.loom_type);
  }, [looms, form.loom_type]);

  function openCreate() {
    if (!canCreate) return;
    setForm({
      target_type: "DAILY",
      target_date: today,
      loom_type: "",
      loom_id: "",
      target_meter: "0",
      target_kg: "0",
      remarks: "",
    });
    setFieldErrors({});
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    setFieldErrors({});

    const payload = {
      target_type: form.target_type,
      target_date: form.target_date,
      loom_id: form.loom_id || null,
      target_meter: Number(form.target_meter) || 0,
      target_kg: Number(form.target_kg) || 0,
      actual_meter: 0,
      actual_kg: 0,
      remarks: form.remarks || null,
    };

    const result = validateForm(targetFormSchema, {
      ...payload,
      loom_type: form.loom_type || undefined,
    });
    if (result.errors) {
      setFieldErrors(result.errors);
      setSaving(false);
      return;
    }

    // loom_type is UI-only (not a DB column); keep on demo rows for display
    const persistPayload = {
      ...payload,
      ...(form.loom_type ? { loom_type: form.loom_type } : {}),
    };

    const { data, error: err } = await insertRow("opa_production_targets", persistPayload, {
      module: "production",
      user_id: profile?.id,
      user_name: profile?.full_name,
    });

    if (err) {
      setInfo(err);
    } else if (data) {
      setRows((prev) => [data as TargetRow, ...prev]);
    } else {
      await load();
    }
    setOpen(false);
    setSaving(false);
  }

  const ragTone =
    totals.rag === "green" ? "running" : totals.rag === "amber" ? "amber" : "breakdown";

  return (
    <>
      <PageHeader
        title="Production Targets"
        subtitle="Daily, shift, loom and monthly targets with achievement RAG."
        meta={
          demoMode || info ? (
            <span className="live-chip">{demoMode ? "Demo Mode" : info ?? "Live"}</span>
          ) : null
        }
        actions={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              Create target
            </button>
          ) : null
        }
      />

      <div className="fleet-grid">
        <StatCard
          label="Target"
          value={`${Math.round(totals.target).toLocaleString("en-IN")} M`}
          hint="Sum of listed targets"
        />
        <StatCard
          label="Actual"
          value={`${Math.round(totals.actual).toLocaleString("en-IN")} M`}
          hint="Recorded production"
          tone="sky"
        />
        <StatCard
          label="Balance"
          value={`${Math.round(totals.balance).toLocaleString("en-IN")} M`}
          hint="Remaining to target"
          tone="amber"
        />
        <StatCard
          label="Achievement %"
          value={`${totals.achievement.toFixed(1)}%`}
          hint={totals.rag.toUpperCase()}
          tone={ragTone}
        />
      </div>

      <section className="panel page-card" style={{ marginTop: "1rem" }}>
        <AchievementIndicator
          level={totals.rag}
          value={`${totals.achievement.toFixed(1)}%`}
          label={`Plant achievement · ${totals.rag === "green" ? "≥95%" : totals.rag === "amber" ? "80–94%" : "<80%"}`}
        />
      </section>

      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title="No targets yet"
            description="Create a daily, shift, loom or monthly target."
            action={canCreate ? { label: "Create target", onClick: openCreate } : undefined}
          />
        ) : null}
        {!loading && rows.length > 0 ? (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        ) : null}
      </section>

      <Modal
        open={open}
        title="Create production target"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="create-production-target"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="create-production-target" className="form-grid" onSubmit={handleCreate}>
          <TextSelect
            label="Type"
            required
            value={form.target_type}
            error={fieldErrors.target_type}
            onChange={(e) => setForm((f) => ({ ...f, target_type: e.target.value }))}
          >
            <option value="DAILY">DAILY</option>
            <option value="SHIFT">SHIFT</option>
            <option value="LOOM">LOOM</option>
            <option value="MONTHLY">MONTHLY</option>
          </TextSelect>
          <TextInput
            label={form.target_type === "MONTHLY" ? "Month date" : "Date"}
            type="date"
            required
            value={form.target_date}
            error={fieldErrors.target_date}
            onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
          />
          <TextSelect
            label="Loom type (optional)"
            value={form.loom_type}
            onChange={(e) =>
              setForm((f) => ({ ...f, loom_type: e.target.value, loom_id: "" }))
            }
          >
            <option value="">All / plant</option>
            <option value="DOBBY">DOBBY</option>
            <option value="PLAIN">PLAIN</option>
          </TextSelect>
          <TextSelect
            label="Loom (optional)"
            value={form.loom_id}
            onChange={(e) => setForm((f) => ({ ...f, loom_id: e.target.value }))}
          >
            <option value="">None</option>
            {filteredLooms.map((l) => (
              <option key={l.id} value={l.id}>
                {displayLoomNumber(l)} · {l.loom_type}
              </option>
            ))}
          </TextSelect>
          <TextInput
            label="Target meters"
            type="number"
            required
            value={form.target_meter}
            error={fieldErrors.target_meter}
            onChange={(e) => setForm((f) => ({ ...f, target_meter: e.target.value }))}
          />
          <TextInput
            label="Target kg"
            type="number"
            value={form.target_kg}
            error={fieldErrors.target_kg}
            onChange={(e) => setForm((f) => ({ ...f, target_kg: e.target.value }))}
          />
          <TextTextarea
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          />
        </form>
        {form.target_type === "LOOM" && !form.loom_id ? (
          <AlertBanner
            tone="warning"
            title="Loom target"
          >
            Select a loom when creating a LOOM-level target.
          </AlertBanner>
        ) : null}
      </Modal>
    </>
  );
}
