import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadCsv, listRows, type Row } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  DataTable,
  TextInput,
  TextSelect,
  LoadingState,
  type Column,
} from "@/components/ui";

const ENTITIES = [
  { value: "opa_production_entries", label: "Production entries", cols: ["entry_number", "entry_date", "production_meter", "efficiency"] },
  { value: "opa_loom_stoppages", label: "Stoppages", cols: ["loom_id", "reason", "start_time", "end_time"] },
  { value: "opa_purchase_orders", label: "Purchase orders", cols: ["po_number", "po_date", "total_amount", "status"] },
  { value: "opa_sales_orders", label: "Sales orders", cols: ["so_number", "so_date", "total_amount", "status"] },
  { value: "opa_alerts", label: "Alerts", cols: ["severity", "title", "module", "is_resolved"] },
] as const;

export default function ReportsPage() {
  const { can } = useAuth();
  const canExport = can("reports", "export") || can("reports", "view");
  const [entity, setEntity] = useState<string>(ENTITIES[0].value);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const meta = ENTITIES.find((e) => e.value === entity) ?? ENTITIES[0];

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listRows(entity, { limit: 500 });
    const filtered = result.data.filter((r) => {
      const dateVal =
        r.entry_date ?? r.po_date ?? r.so_date ?? r.start_time ?? r.created_at;
      if (!dateVal) return true;
      const d = String(dateVal).slice(0, 10);
      return d >= from && d <= to;
    });
    setRows(filtered);
    setLoading(false);
  }, [entity, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<Row>[] = useMemo(
    () =>
      meta.cols.map((c) => ({
        key: c,
        header: c.replace(/_/g, " "),
        render: (r: Row) => String(r[c] ?? "—"),
      })),
    [meta],
  );

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Filter operational datasets and export CSV."
        actions={
          canExport ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                downloadCsv(
                  `${meta.label.replace(/\s+/g, "-").toLowerCase()}-${from}.csv`,
                  rows,
                  [...meta.cols],
                )
              }
            >
              Export CSV
            </button>
          ) : null
        }
      />

      <section className="panel page-card">
        <div className="form-grid">
          <TextSelect
            label="Report"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
          >
            {ENTITIES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </TextSelect>
          <TextInput
            label="From"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextInput
            label="To"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </section>

      <section className="panel table-panel">
        {loading ? <LoadingState /> : <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />}
      </section>
    </>
  );
}
