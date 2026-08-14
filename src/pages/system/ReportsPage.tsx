import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadCsv, listRows, type Row } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import { useAuth } from "@/context/AuthContext";
import {
  PageHeader,
  DataTable,
  TextInput,
  TextSelect,
  LoadingState,
  type Column,
} from "@/components/ui";

type ReportDef = {
  value: string;
  label: string;
  cols: string[];
  /** Optional table to load; when absent, generate demo rows */
  table?: string;
  dateKeys?: string[];
  demoRows?: () => Row[];
};

function demoId(n: number) {
  return `00000000-0000-4000-8000-rep${String(n).padStart(8, "0")}`.slice(0, 36);
}

const today = () => new Date().toISOString().slice(0, 10);

const REPORTS: ReportDef[] = [
  {
    value: "daily_production",
    label: "Daily Production",
    table: "opa_production_entries",
    cols: ["entry_number", "entry_date", "production_meter", "efficiency"],
    dateKeys: ["entry_date"],
  },
  {
    value: "monthly_production",
    label: "Monthly Production",
    cols: ["month", "target_meter", "actual_meter", "achievement_pct"],
    demoRows: () => [
      {
        id: demoId(1),
        month: today().slice(0, 7),
        target_meter: 2100000,
        actual_meter: 1684500,
        achievement_pct: 80.2,
      },
    ],
  },
  {
    value: "loom_performance",
    label: "Loom Performance",
    table: "opa_looms",
    cols: ["loom_number", "loom_type", "status", "efficiency", "location"],
  },
  {
    value: "efficiency",
    label: "Efficiency",
    cols: ["loom_number", "shift", "efficiency", "running_hours", "stop_hours"],
    demoRows: () => [
      {
        id: demoId(2),
        loom_number: "D01",
        shift: "A",
        efficiency: 92.4,
        running_hours: 7.4,
        stop_hours: 0.6,
      },
      {
        id: demoId(3),
        loom_number: "P10",
        shift: "A",
        efficiency: 78.1,
        running_hours: 6.2,
        stop_hours: 1.8,
      },
    ],
  },
  {
    value: "downtime",
    label: "Downtime",
    table: "opa_loom_stoppages",
    cols: ["loom_id", "reason", "start_time", "end_time", "duration_minutes"],
    dateKeys: ["start_time"],
  },
  {
    value: "breakdown",
    label: "Breakdown",
    cols: ["loom_number", "issue", "downtime_hours", "mttr_hours", "status"],
    demoRows: () => [
      {
        id: demoId(4),
        loom_number: "D23",
        issue: "Main motor trip",
        downtime_hours: 6.5,
        mttr_hours: 2.5,
        status: "OPEN",
      },
      {
        id: demoId(5),
        loom_number: "P10",
        issue: "Air pressure drop",
        downtime_hours: 1.25,
        mttr_hours: 1.25,
        status: "CLOSED",
      },
    ],
  },
  {
    value: "maintenance_cost",
    label: "Maintenance Cost",
    table: "opa_maintenance_work_orders",
    cols: ["wo_number", "work_description", "labour_hours", "status", "priority"],
  },
  {
    value: "yarn_inventory",
    label: "Yarn / Beam / Inventory",
    table: "opa_inventory_items",
    cols: ["item_code", "name", "category", "current_qty", "reorder_level", "uom"],
  },
  {
    value: "purchase",
    label: "Purchase",
    table: "opa_purchase_orders",
    cols: ["po_number", "po_date", "total_amount", "status"],
    dateKeys: ["po_date"],
  },
  {
    value: "grn",
    label: "GRN",
    table: "opa_grns",
    cols: ["grn_number", "grn_date", "status", "remarks"],
    dateKeys: ["grn_date"],
    demoRows: () => [
      {
        id: demoId(6),
        grn_number: `GRN-${today().replace(/-/g, "")}-001`,
        grn_date: today(),
        status: "POSTED",
        remarks: "Yarn receipt lot A12",
      },
    ],
  },
  {
    value: "visitor",
    label: "Visitor",
    table: "opa_visitors",
    cols: ["visitor_code", "full_name", "company", "mobile"],
  },
  {
    value: "ceo_requests",
    label: "CEO requests",
    table: "opa_ceo_visit_requests",
    cols: ["request_number", "visitor_name", "purpose", "status"],
  },
];

export default function ReportsPage() {
  const { can, demoMode } = useAuth();
  const canExport = can("reports", "export") || can("reports", "view");
  const { busy, exportCsv, exportExcel, exportPdf } = useExport();
  const [entity, setEntity] = useState<string>(REPORTS[0].value);
  const [from, setFrom] = useState(() => today());
  const [to, setTo] = useState(() => today());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const meta = REPORTS.find((e) => e.value === entity) ?? REPORTS[0];

  const load = useCallback(async () => {
    setLoading(true);
    if (!meta.table) {
      setRows(meta.demoRows?.() ?? []);
      setLoading(false);
      return;
    }
    const result = await listRows(meta.table, {
      limit: 500,
      demoRows: meta.demoRows?.(),
    });
    let data = result.data;
    if (!data.length && meta.demoRows) data = meta.demoRows();
    const dateKeys = meta.dateKeys ?? [];
    const filtered =
      dateKeys.length === 0
        ? data
        : data.filter((r) => {
            const dateVal = dateKeys.map((k) => r[k]).find(Boolean);
            if (!dateVal) return true;
            const d = String(dateVal).slice(0, 10);
            return d >= from && d <= to;
          });
    setRows(filtered);
    setLoading(false);
  }, [meta, from, to]);

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

  const exportRows = useMemo(
    () =>
      rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const c of meta.cols) out[c] = r[c] ?? "";
        return out;
      }),
    [rows, meta.cols],
  );

  const baseName = `${meta.label.replace(/\s+/g, "-").toLowerCase()}-${from}`;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Operational reports with CSV, Excel and PDF export."
        meta={demoMode ? <span className="live-chip">Demo Mode</span> : null}
        actions={
          canExport ? (
            <div className="page-header-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!rows.length || busy}
                onClick={() => downloadCsv(`${baseName}.csv`, rows, [...meta.cols])}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!exportRows.length || busy}
                onClick={() => exportCsv(baseName, exportRows)}
              >
                CSV (useExport)
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!exportRows.length || busy}
                onClick={() => exportExcel(baseName, exportRows, meta.label.slice(0, 28))}
              >
                Excel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!exportRows.length || busy}
                onClick={() => exportPdf(baseName, meta.label, exportRows)}
              >
                PDF
              </button>
            </div>
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
            {REPORTS.map((e) => (
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
