import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { StatusBadge, AchievementPct } from "@/components/ui";
import { qualityFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const DEFECT_TYPES = [
  "Broken End",
  "Broken Pick",
  "Oil Mark",
  "Stain",
  "Hole",
  "Reed Mark",
  "Dobby Error",
  "Color Variation",
  "Width Variation",
  "GSM Variation",
  "Other",
].map((v) => ({ value: v, label: v }));

function pct(good: number, checked: number) {
  if (!checked) return null;
  return Math.round((good / checked) * 1000) / 10;
}

const columns: Column<Row>[] = [
  {
    key: "inspection_number",
    header: "Inspection #",
    render: (r) => String(r.inspection_number ?? "—"),
  },
  {
    key: "inspection_date",
    header: "Date",
    render: (r) => String(r.inspection_date ?? "—"),
  },
  {
    key: "loom_id",
    header: "Loom",
    render: (r) => String(r.loom_id ?? "—").slice(0, 12),
  },
  {
    key: "result",
    header: "Result",
    render: (r) => <StatusBadge status={String(r.result ?? "PASS")} />,
  },
  {
    key: "meters_checked",
    header: "Checked",
    render: (r) =>
      Number(r.meters_checked ?? r.sample_meters ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "good_meters",
    header: "Good",
    render: (r) => Number(r.good_meters ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "rejected_meters",
    header: "Rejected",
    render: (r) => Number(r.rejected_meters ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "good_pct",
    header: "Good %",
    render: (r) => {
      const checked = Number(r.meters_checked ?? r.sample_meters ?? 0);
      const good = Number(r.good_meters ?? 0);
      const p = pct(good, checked);
      return p == null ? "—" : <AchievementPct value={p} />;
    },
  },
  {
    key: "defect_type",
    header: "Defect",
    render: (r) => String(r.defect_type ?? "—"),
  },
  { key: "remarks", header: "Remarks", render: (r) => String(r.remarks ?? "—") },
];

const fields = [
  {
    name: "inspection_number",
    label: "Inspection number",
    type: "text" as const,
    required: true,
  },
  {
    name: "inspection_date",
    label: "Date",
    type: "date" as const,
    required: true,
  },
  {
    name: "loom_id",
    label: "Loom ID",
    type: "text" as const,
    placeholder: "demo-loom-01",
  },
  {
    name: "customer_name",
    label: "Customer",
    type: "text" as const,
  },
  {
    name: "production_lot",
    label: "Production lot",
    type: "text" as const,
  },
  {
    name: "result",
    label: "Result",
    type: "select" as const,
    required: true,
    options: [
      { value: "PASS", label: "PASS" },
      { value: "FAIL", label: "FAIL" },
      { value: "HOLD", label: "HOLD" },
      { value: "REWORK", label: "REWORK" },
    ],
  },
  { name: "grade", label: "Grade", type: "text" as const },
  {
    name: "meters_checked",
    label: "Meters checked",
    type: "number" as const,
    required: true,
  },
  {
    name: "good_meters",
    label: "Good meters",
    type: "number" as const,
    required: true,
  },
  {
    name: "rejected_meters",
    label: "Rejected meters",
    type: "number" as const,
    required: true,
  },
  {
    name: "defect_type",
    label: "Defect type",
    type: "select" as const,
    options: DEFECT_TYPES,
  },
  {
    name: "defect_quantity",
    label: "Defect quantity",
    type: "number" as const,
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function QualityPage() {
  return (
    <ModulePage
      title="Quality & Inspection"
      subtitle="Meters checked, good/rejection %, defect classification — linked to looms."
      table="opa_quality_inspections"
      moduleKey="quality"
      columns={columns}
      fields={fields}
      orderBy={{ column: "inspection_date", ascending: false }}
      schema={qualityFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          inspection_date: d,
          inspection_number: `QC-${d.replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`,
          result: "PASS",
          meters_checked: 100,
          good_meters: 98,
          rejected_meters: 2,
          defect_type: "Other",
          defect_quantity: 0,
        };
      }}
    />
  );
}
