import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { downloadCsv, listRows, type Row } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  DataTable,
  TextInput,
  TextSelect,
  LoadingState,
  EmptyState,
  type Column,
} from "@/components/ui";

const REPORT_TYPES = [
  { id: "production", label: "Daily Production", table: "opa_production_entries", dateCol: "entry_date", cols: ["entry_number", "entry_date", "production_meter", "efficiency", "downtime_hours"] },
  { id: "shift", label: "Shift Production", table: "opa_production_entries", dateCol: "entry_date", cols: ["entry_number", "entry_date", "shift_id", "production_meter", "efficiency"] },
  { id: "loom", label: "Loom-wise Production", table: "opa_production_entries", dateCol: "entry_date", cols: ["loom_id", "entry_date", "production_meter", "efficiency"] },
  { id: "article", label: "Article-wise Production", table: "opa_production_entries", dateCol: "entry_date", cols: ["article_id", "entry_date", "production_meter", "production_kg"] },
  { id: "efficiency", label: "Efficiency Report", table: "opa_production_entries", dateCol: "entry_date", cols: ["entry_number", "entry_date", "efficiency", "production_meter"] },
  { id: "downtime", label: "Downtime Report", table: "opa_loom_stoppages", dateCol: "start_time", cols: ["loom_id", "reason", "start_time", "end_time"] },
  { id: "breakdown", label: "Breakdown Report", table: "opa_maintenance_requests", dateCol: "created_at", cols: ["request_number", "status", "description", "created_at"] },
  { id: "quality", label: "Quality/Rejection Report", table: "opa_quality_inspections", dateCol: "created_at", cols: ["inspection_number", "result", "defect_type", "created_at"] },
  { id: "yarn", label: "Yarn Consumption", table: "opa_yarn_master", dateCol: "updated_at", cols: ["yarn_code", "yarn_name", "current_stock_kg", "unit"] },
  { id: "stock", label: "Stock Report", table: "opa_inventory_items", dateCol: "updated_at", cols: ["item_code", "item_name", "current_qty", "reorder_level"] },
  { id: "maintenance", label: "Maintenance Report", table: "opa_maintenance_work_orders", dateCol: "created_at", cols: ["wo_number", "status", "description", "created_at"] },
] as const;

export default function ReportsPage() {
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") ?? "production";
  const canExport = can("reports", "export") || can("reports", "view");

  const [reportId, setReportId] = useState<string>(
    REPORT_TYPES.find((r) => r.id === initialType)?.id ?? "production",
  );
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState("");
  const [loomFilter, setLoomFilter] = useState("");
  const [articleFilter, setArticleFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const meta = REPORT_TYPES.find((r) => r.id === reportId) ?? REPORT_TYPES[0];

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listRows(meta.table, { limit: 500 });
    const filtered = result.data.filter((r) => {
      const dateVal = r[meta.dateCol] ?? r.entry_date ?? r.created_at;
      if (dateVal) {
        const d = String(dateVal).slice(0, 10);
        if (d < from || d > to) return false;
      }
      if (shift && r.shift_id && String(r.shift_id) !== shift) return false;
      if (loomFilter && r.loom_id && !String(r.loom_id).includes(loomFilter)) return false;
      if (articleFilter && r.article_id && !String(r.article_id).includes(articleFilter)) return false;
      return true;
    });
    setRows(filtered);
    setLoading(false);
  }, [meta, from, to, shift, loomFilter, articleFilter]);

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

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Production, efficiency, downtime, quality, stock and maintenance reports."
        actions={
          canExport ? (
            <div className="page-header-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handlePrint}
              >
                Print
              </button>
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
                Export Excel
              </button>
            </div>
          ) : null
        }
      />

      <section className="panel page-card">
        <div className="form-grid">
          <TextSelect
            label="Report"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
          >
            {REPORT_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </TextSelect>
          <TextInput label="Date from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextInput label="Date to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <TextInput label="Shift" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="Optional" />
          <TextInput label="Loom" value={loomFilter} onChange={(e) => setLoomFilter(e.target.value)} placeholder="Optional" />
          <TextInput label="Article" value={articleFilter} onChange={(e) => setArticleFilter(e.target.value)} placeholder="Optional" />
          <div>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              Search
            </button>
          </div>
        </div>
      </section>

      <section className="panel table-panel">
        {loading ? (
          <LoadingState label="Loading report data…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No records found" description="Adjust filters or date range and try again." />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => String(r.id)} pageSize={25} />
        )}
      </section>
    </>
  );
}
