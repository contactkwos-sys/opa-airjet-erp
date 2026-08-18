import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { AchievementPct } from "@/components/ui";
import { targetFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

function achievement(target: number, actual: number) {
  if (!target) return null;
  return Math.round((actual / target) * 1000) / 10;
}

const columns: Column<Row>[] = [
  { key: "target_type", header: "Type", render: (r) => String(r.target_type ?? "—") },
  { key: "target_date", header: "Date", render: (r) => String(r.target_date ?? "—") },
  {
    key: "loom_id",
    header: "Loom",
    render: (r) => (r.loom_id ? String(r.loom_id).slice(0, 12) : "—"),
  },
  {
    key: "target_meter",
    header: "Target (M)",
    render: (r) => Number(r.target_meter ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "actual_meter",
    header: "Actual (M)",
    render: (r) => Number(r.actual_meter ?? 0).toLocaleString("en-IN"),
  },
  {
    key: "difference",
    header: "Diff",
    render: (r) => {
      const d = Number(r.actual_meter ?? 0) - Number(r.target_meter ?? 0);
      return d.toLocaleString("en-IN");
    },
  },
  {
    key: "achievement",
    header: "Achievement",
    render: (r) => {
      const p = achievement(Number(r.target_meter ?? 0), Number(r.actual_meter ?? 0));
      return p == null ? "—" : <AchievementPct value={p} />;
    },
  },
  { key: "remarks", header: "Remarks", render: (r) => String(r.remarks ?? "—") },
];

const fields = [
  {
    name: "target_type",
    label: "Type",
    type: "select" as const,
    required: true,
    options: [
      { value: "DAILY", label: "DAILY" },
      { value: "SHIFT", label: "SHIFT" },
      { value: "LOOM", label: "LOOM" },
      { value: "MONTHLY", label: "MONTHLY" },
    ],
  },
  { name: "target_date", label: "Date", type: "date" as const, required: true },
  {
    name: "loom_id",
    label: "Loom ID (for LOOM targets)",
    type: "text" as const,
    placeholder: "demo-loom-01",
  },
  {
    name: "target_meter",
    label: "Target meters",
    type: "number" as const,
    required: true,
  },
  {
    name: "actual_meter",
    label: "Actual meters",
    type: "number" as const,
    required: true,
  },
  {
    name: "target_kg",
    label: "Target KG",
    type: "number" as const,
  },
  {
    name: "actual_kg",
    label: "Actual KG",
    type: "number" as const,
  },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function TargetsPage() {
  return (
    <ModulePage
      title="Production Target vs Actual"
      subtitle="Daily, shift, loom and monthly targets with red/amber/green achievement."
      table="opa_production_targets"
      moduleKey="production"
      columns={columns}
      fields={fields}
      orderBy={{ column: "target_date", ascending: false }}
      schema={targetFormSchema}
      createDefaults={() => ({
        target_type: "DAILY",
        target_date: new Date().toISOString().slice(0, 10),
        target_meter: 85000,
        actual_meter: 0,
        target_kg: 0,
        actual_kg: 0,
      })}
    />
  );
}
