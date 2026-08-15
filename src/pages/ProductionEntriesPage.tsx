import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";
import { buildDemoLooms, buildDemoProductionEntries } from "@/lib/demoData";
import { calculateProduction } from "@/lib/productionCalc";
import { displayLoomNumber } from "@/lib/loomCodes";
import { useAuth } from "@/context/AuthContext";
import { useExport } from "@/hooks/useExport";
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

const SHIFTS = ["A", "B", "C"] as const;

export default function ProductionEntriesPage() {
  const { profile } = useAuth();
  const { exportExcel, exportPdf, exportCsv } = useExport();
  const [entries, setEntries] = useState<OpaProductionEntry[]>([]);
  const [looms, setLooms] = useState<OpaLoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterShift, setFilterShift] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    entry_number: `PE-${today.replace(/-/g, "")}-NEW`,
    entry_date: today,
    shift_code: "A",
    loom_id: "",
    operator_name: "",
    style: "",
    design: "",
    fabric_quality: "A",
    fabric_width: "190",
    gsm: "120",
    warp_count: "",
    weft_count: "",
    beam_no: "",
    opening_meter: "0",
    closing_meter: "0",
    production_kg: "",
    waste_kg: "0",
    running_hours: "7.5",
    stop_hours: "0.5",
    remarks: "",
  });

  const loomMap = useMemo(() => {
    const m = new Map<string, OpaLoom>();
    for (const l of looms) m.set(l.id, l);
    return m;
  }, [looms]);

  const calc = useMemo(
    () =>
      calculateProduction({
        opening_meter: Number(form.opening_meter),
        closing_meter: Number(form.closing_meter),
        production_kg: form.production_kg ? Number(form.production_kg) : null,
        waste_kg: Number(form.waste_kg),
        running_hours: Number(form.running_hours),
        stop_hours: Number(form.stop_hours),
        gsm: Number(form.gsm),
        fabric_width: Number(form.fabric_width),
      }),
    [form],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const demoLooms = buildDemoLooms();
    const sb = getSupabase();
    if (!sb) {
      setLooms(demoLooms);
      setEntries(buildDemoProductionEntries(demoLooms));
      setForm((f) => ({ ...f, loom_id: demoLooms[0]?.id ?? "" }));
      setLoading(false);
      return;
    }
    try {
      const [loomRes, entryRes] = await Promise.all([
        sb.from("opa_looms").select("*").order("loom_number"),
        sb
          .from("opa_production_entries")
          .select("*")
          .order("entry_date", { ascending: false })
          .limit(200),
      ]);
      const loadedLooms = loomRes.data?.length ? (loomRes.data as OpaLoom[]) : demoLooms;
      setLooms(loadedLooms);
      if (entryRes.error) throw entryRes.error;
      if (entryRes.data?.length) setEntries(entryRes.data as OpaProductionEntry[]);
      else setEntries(buildDemoProductionEntries(loadedLooms));
      setForm((f) => ({ ...f, loom_id: loadedLooms[0]?.id ?? "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setLooms(demoLooms);
      setEntries(buildDemoProductionEntries(demoLooms));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterShift !== "ALL" && (e.shift_code || "A") !== filterShift) return false;
      if (filterType !== "ALL") {
        const loom = loomMap.get(e.loom_id);
        if (!loom || loom.loom_type !== filterType) return false;
      }
      return true;
    });
  }, [entries, filterShift, filterType, loomMap]);

  const totals = useMemo(() => {
    const meters = filtered.reduce((s, e) => s + (e.production_meter ?? 0), 0);
    const kg = filtered.reduce((s, e) => s + (e.production_kg ?? 0), 0);
    const waste = filtered.reduce((s, e) => s + (e.waste_kg ?? 0), 0);
    const eff =
      filtered.length === 0
        ? 0
        : filtered.reduce((s, e) => s + (e.efficiency ?? 0), 0) / filtered.length;
    return { meters, kg, waste, eff };
  }, [filtered]);

  const columns: Column<OpaProductionEntry>[] = [
    { key: "entry_number", header: "Entry #", render: (r) => r.entry_number },
    { key: "entry_date", header: "Date", render: (r) => r.entry_date },
    { key: "shift", header: "Shift", render: (r) => r.shift_code ?? "—" },
    {
      key: "loom",
      header: "Loom",
      render: (r) => {
        const loom = loomMap.get(r.loom_id);
        return loom ? displayLoomNumber(loom) : r.loom_id.slice(0, 8);
      },
    },
    {
      key: "production_meter",
      header: "Meters",
      render: (r) => r.production_meter.toLocaleString("en-IN"),
    },
    {
      key: "production_kg",
      header: "Kg",
      render: (r) => (r.production_kg != null ? r.production_kg.toLocaleString("en-IN") : "—"),
    },
    {
      key: "efficiency",
      header: "Eff %",
      render: (r) => (r.efficiency != null ? `${r.efficiency}%` : "—"),
    },
    { key: "operator", header: "Operator", render: (r) => r.operator_name ?? "—" },
  ];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (Number(form.closing_meter) < Number(form.opening_meter)) {
      setError("Closing meter must be ≥ opening meter");
      return;
    }
    setSaving(true);
    const payload = {
      entry_number: form.entry_number,
      entry_date: form.entry_date,
      loom_id: form.loom_id,
      shift_code: form.shift_code,
      operator_name: form.operator_name || null,
      style: form.style || null,
      design: form.design || null,
      fabric_quality: form.fabric_quality || null,
      fabric_width: Number(form.fabric_width) || null,
      gsm: Number(form.gsm) || null,
      warp_count: form.warp_count || null,
      weft_count: form.weft_count || null,
      beam_no: form.beam_no || null,
      opening_meter: Number(form.opening_meter),
      closing_meter: Number(form.closing_meter),
      production_kg: calc.production_kg,
      waste_kg: calc.waste_kg,
      waste_percentage: calc.waste_percentage,
      running_hours: calc.running_hours,
      downtime_hours: calc.downtime_hours,
      efficiency: calc.efficiency,
      remarks: form.remarks || null,
    };
    const sb = getSupabase();
    if (!sb) {
      setEntries((prev) => [
        {
          id: crypto.randomUUID(),
          ...payload,
          shift_id: null,
          article_id: null,
          production_meter: calc.production_meter,
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
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  function exportRows() {
    return filtered.map((r) => ({
      entry_number: r.entry_number,
      date: r.entry_date,
      shift: r.shift_code,
      loom: loomMap.get(r.loom_id) ? displayLoomNumber(loomMap.get(r.loom_id)!) : r.loom_id,
      meters: r.production_meter,
      kg: r.production_kg,
      waste_kg: r.waste_kg,
      efficiency: r.efficiency,
      operator: r.operator_name,
    }));
  }

  return (
    <>
      <PageHeader
        title="Production Entry"
        subtitle="Shift A/B/C capture with automatic meter, kg, waste %, efficiency & downtime."
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={() => exportCsv("production-entries", exportRows())}
            >
              CSV
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => exportExcel("production-entries", exportRows())}
            >
              Excel
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => exportPdf("production-entries", "Production Entries", exportRows())}
            >
              PDF
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              New entry
            </button>
          </>
        }
      />

      <div className="fleet-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatCard label="Entries" value={filtered.length} />
        <StatCard label="Total meters" value={totals.meters.toLocaleString("en-IN")} tone="running" />
        <StatCard label="Total kg" value={totals.kg.toLocaleString("en-IN")} />
        <StatCard label="Avg efficiency" value={`${totals.eff.toFixed(1)}%`} />
      </div>

      <div className="toolbar-row" style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        <TextSelect label="Shift" value={filterShift} onChange={(e) => setFilterShift(e.target.value)}>
          <option value="ALL">All shifts</option>
          {SHIFTS.map((s) => (
            <option key={s} value={s}>
              Shift {s}
            </option>
          ))}
        </TextSelect>
        <TextSelect label="Loom type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="ALL">Dobby + Plain</option>
          <option value="DOBBY">Dobby</option>
          <option value="PLAIN">Plain</option>
        </TextSelect>
      </div>

      <section className="panel table-panel">
        {loading ? <LoadingState /> : null}
        {!loading && error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {!loading && filtered.length === 0 ? (
          <EmptyState
            title="No production entries"
            action={{ label: "New entry", onClick: () => setOpen(true) }}
          />
        ) : null}
        {!loading && filtered.length > 0 ? (
          <DataTable columns={columns} rows={filtered} rowKey={(r) => r.id} pageSize={15} />
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
            label="Shift"
            required
            value={form.shift_code}
            onChange={(e) => setForm((f) => ({ ...f, shift_code: e.target.value }))}
          >
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                Shift {s}
              </option>
            ))}
          </TextSelect>
          <TextSelect
            label="Loom"
            required
            value={form.loom_id}
            onChange={(e) => setForm((f) => ({ ...f, loom_id: e.target.value }))}
          >
            {looms.map((l) => (
              <option key={l.id} value={l.id}>
                {displayLoomNumber(l)} · {l.loom_type}
              </option>
            ))}
          </TextSelect>
          <TextInput
            label="Operator"
            value={form.operator_name}
            onChange={(e) => setForm((f) => ({ ...f, operator_name: e.target.value }))}
          />
          <TextInput
            label="Style"
            value={form.style}
            onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}
          />
          <TextInput
            label="Design"
            value={form.design}
            onChange={(e) => setForm((f) => ({ ...f, design: e.target.value }))}
          />
          <TextInput
            label="Fabric quality"
            value={form.fabric_quality}
            onChange={(e) => setForm((f) => ({ ...f, fabric_quality: e.target.value }))}
          />
          <TextInput
            label="Fabric width (cm)"
            type="number"
            value={form.fabric_width}
            onChange={(e) => setForm((f) => ({ ...f, fabric_width: e.target.value }))}
          />
          <TextInput
            label="GSM"
            type="number"
            value={form.gsm}
            onChange={(e) => setForm((f) => ({ ...f, gsm: e.target.value }))}
          />
          <TextInput
            label="Warp count"
            value={form.warp_count}
            onChange={(e) => setForm((f) => ({ ...f, warp_count: e.target.value }))}
          />
          <TextInput
            label="Weft count"
            value={form.weft_count}
            onChange={(e) => setForm((f) => ({ ...f, weft_count: e.target.value }))}
          />
          <TextInput
            label="Beam no"
            value={form.beam_no}
            onChange={(e) => setForm((f) => ({ ...f, beam_no: e.target.value }))}
          />
          <TextInput
            label="Starting meter"
            type="number"
            required
            value={form.opening_meter}
            onChange={(e) => setForm((f) => ({ ...f, opening_meter: e.target.value }))}
          />
          <TextInput
            label="Ending meter"
            type="number"
            required
            value={form.closing_meter}
            onChange={(e) => setForm((f) => ({ ...f, closing_meter: e.target.value }))}
          />
          <TextInput
            label="Waste kg"
            type="number"
            value={form.waste_kg}
            onChange={(e) => setForm((f) => ({ ...f, waste_kg: e.target.value }))}
          />
          <TextInput
            label="Running hours"
            type="number"
            value={form.running_hours}
            onChange={(e) => setForm((f) => ({ ...f, running_hours: e.target.value }))}
          />
          <TextInput
            label="Stop hours"
            type="number"
            value={form.stop_hours}
            onChange={(e) => setForm((f) => ({ ...f, stop_hours: e.target.value }))}
          />
          <TextInput
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          />
          <div className="panel" style={{ gridColumn: "1 / -1" }}>
            <strong>Auto-calculated</strong>
            <p>
              Production: {calc.production_meter} m · {calc.production_kg} kg · Waste{" "}
              {calc.waste_percentage}% · Eff {calc.efficiency}% · Downtime {calc.downtime_hours} h
            </p>
          </div>
        </form>
      </Modal>
    </>
  );
}
