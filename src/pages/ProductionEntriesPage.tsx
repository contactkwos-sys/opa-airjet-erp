import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { buildDemoLooms, buildDemoProductionEntries } from "@/lib/demoData";
import { listRows, toUserError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { OpaLoom, OpaProductionEntry } from "@/types/database";
import {
  PageHeader,
  DataTable,
  Modal,
  TextInput,
  TextSelect,
  LoadingState,
  ErrorState,
  EmptyState,
  StatCard,
  AlertBanner,
  type Column,
} from "@/components/ui";

export default function ProductionEntriesPage() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<OpaProductionEntry[]>([]);
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDemo, setFromDemo] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    entry_number: `PE-${today.replace(/-/g, "")}-NEW`,
    entry_date: today,
    loom_id: "",
    opening_meter: "0",
    closing_meter: "0",
    efficiency: "90",
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
    const demoLooms = buildDemoLooms();
    const [loomRes, entryRes] = await Promise.all([
      listRows("opa_looms", {
        orderBy: { column: "loom_number", ascending: true },
        limit: 200,
        demoRows: demoLooms as unknown as Array<{ id: string } & Record<string, unknown>>,
      }),
      listRows("opa_production_entries", {
        orderBy: { column: "entry_date", ascending: false },
        limit: 100,
        demoRows: buildDemoProductionEntries(demoLooms) as unknown as Array<
          { id: string } & Record<string, unknown>
        >,
      }),
    ]);

    const loadedLooms = (loomRes.data.length ? loomRes.data : demoLooms) as OpaLoom[];
    setLooms(loadedLooms);
    setEntries(
      (entryRes.data.length
        ? entryRes.data
        : buildDemoProductionEntries(loadedLooms)) as OpaProductionEntry[],
    );
    setFromDemo(loomRes.fromDemo || entryRes.fromDemo);
    setForm((f) => ({ ...f, loom_id: loadedLooms[0]?.id ?? "" }));
    const hardError = [loomRes, entryRes].find((r) => r.error && !r.fromDemo);
    setError(hardError?.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const meters = entries.reduce((s, e) => s + Number(e.production_meter ?? 0), 0);
    const eff =
      entries.length === 0
        ? 0
        : entries.reduce((s, e) => s + Number(e.efficiency ?? 0), 0) / entries.length;
    return { meters, eff };
  }, [entries]);

  const columns: Column<OpaProductionEntry>[] = [
    { key: "entry_number", header: "Entry #", render: (r) => r.entry_number },
    { key: "entry_date", header: "Date", render: (r) => r.entry_date },
    {
      key: "loom",
      header: "Loom",
      render: (r) =>
        loomMap.get(r.loom_id)?.loom_number ??
        (r.loom_id ? String(r.loom_id).slice(0, 8) : "—"),
    },
    {
      key: "production_meter",
      header: "Production (M)",
      render: (r) => Number(r.production_meter ?? 0).toLocaleString("en-IN"),
    },
    {
      key: "efficiency",
      header: "Efficiency",
      render: (r) => (r.efficiency != null ? `${r.efficiency}%` : "—"),
    },
    { key: "remarks", header: "Remarks", render: (r) => r.remarks ?? "—" },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const opening = Number(form.opening_meter);
    const closing = Number(form.closing_meter);
    if (closing < opening) {
      setError("Closing meter must be greater than or equal to opening meter.");
      setSaving(false);
      return;
    }
    const payload = {
      entry_number: form.entry_number,
      entry_date: form.entry_date,
      loom_id: form.loom_id,
      opening_meter: opening,
      closing_meter: closing,
      efficiency: Number(form.efficiency),
      remarks: form.remarks || null,
    };
    const sb = getSupabase();
    if (!sb || fromDemo) {
      setEntries((prev) => [
        {
          id: crypto.randomUUID(),
          ...payload,
          shift_id: null,
          article_id: null,
          production_meter: closing - opening,
          production_kg: null,
          running_hours: null,
          downtime_hours: null,
          operator_id: null,
          supervisor_id: null,
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
        .from("opa_production_entries")
        .insert(payload as never)
        .select()
        .single();
      if (err) throw err;
      await writeAuditLog({
        user_id: profile?.id,
        user_name: profile?.full_name,
        action: "CREATE",
        module: "production",
        record_id: (data as OpaProductionEntry).id,
        new_value: payload as never,
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(toUserError(err, "Could not save production entry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Production Entry"
        subtitle="Shift-wise meter readings and efficiency capture."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            New entry
          </button>
        }
      />

      {fromDemo ? (
        <AlertBanner tone="info" title="Demo data">
          Production tables are not connected yet. Showing preview entries.
        </AlertBanner>
      ) : null}

      <div className="fleet-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <StatCard label="Entries" value={entries.length} />
        <StatCard label="Total meters" value={totals.meters.toLocaleString("en-IN")} tone="running" />
        <StatCard label="Avg efficiency" value={`${totals.eff.toFixed(1)}%`} />
      </div>

      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && entries.length === 0 ? (
          <EmptyState
            title="No production entries"
            action={{ label: "New entry", onClick: () => setOpen(true) }}
          />
        ) : null}
        {!loading && entries.length > 0 ? (
          <DataTable columns={columns} rows={entries} rowKey={(r) => r.id} pageSize={15} />
        ) : null}
      </section>

      <Modal
        open={open}
        title="New production entry"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="create-pe" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <form id="create-pe" className="form-grid" onSubmit={handleCreate}>
          <TextInput
            label="Entry number"
            required
            value={form.entry_number}
            onChange={(e) => setForm((f) => ({ ...f, entry_number: e.target.value }))}
          />
          <TextInput
            label="Date"
            type="date"
            required
            value={form.entry_date}
            onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
          />
          <TextSelect
            label="Loom"
            required
            value={form.loom_id}
            onChange={(e) => setForm((f) => ({ ...f, loom_id: e.target.value }))}
          >
            {looms.map((l) => (
              <option key={l.id} value={l.id}>
                {l.loom_number}
              </option>
            ))}
          </TextSelect>
          <TextInput
            label="Opening meter"
            type="number"
            required
            value={form.opening_meter}
            onChange={(e) => setForm((f) => ({ ...f, opening_meter: e.target.value }))}
          />
          <TextInput
            label="Closing meter"
            type="number"
            required
            value={form.closing_meter}
            onChange={(e) => setForm((f) => ({ ...f, closing_meter: e.target.value }))}
          />
          <TextInput
            label="Efficiency %"
            type="number"
            value={form.efficiency}
            onChange={(e) => setForm((f) => ({ ...f, efficiency: e.target.value }))}
          />
          <TextInput
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          />
        </form>
      </Modal>
    </>
  );
}
