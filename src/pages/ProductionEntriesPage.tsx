import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
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
  type Column,
} from "@/components/ui";

export default function ProductionEntriesPage() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<OpaProductionEntry[]>([]);
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    const [loomRes, entryRes] = await Promise.all([
      listRows("opa_looms", {
        orderBy: { column: "loom_number", ascending: true },
        limit: 200,
      }),
      listRows("opa_production_entries", {
        orderBy: { column: "entry_date", ascending: false },
        limit: 100,
      }),
    ]);

    const loadedLooms = loomRes.data as unknown as OpaLoom[];
    setLooms(loadedLooms);
    setEntries(entryRes.data as unknown as OpaProductionEntry[]);
    setForm((f) => ({ ...f, loom_id: loadedLooms[0]?.id ?? "" }));
    const hardError = [loomRes, entryRes].find((r) => r.error);
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
    if (!sb) {
      setError("Database is not configured. Cannot save.");
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
        title="Daily Production"
        subtitle="Shift-wise production entry, efficiency and downtime reporting."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            New entry
          </button>
        }
      />

      <div className="fleet-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <StatCard label="Entries" value={entries.length} />
        <StatCard label="Total meters" value={totals.meters.toLocaleString("en-IN")} tone="running" />
        <StatCard label="Avg efficiency" value={`${totals.eff.toFixed(1)}%`} />
      </div>

      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && !error && entries.length === 0 ? (
          <EmptyState
            title="No data available"
            description="No production entries found."
            action={{ label: "New entry", onClick: () => setOpen(true) }}
          />
        ) : null}
        {!loading && !error && entries.length > 0 ? (
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
