import { ModulePage } from "@/components/ModulePage";
import type { Column } from "@/components/ui";
import { costingFormSchema } from "@/lib/validation";

type Row = Record<string, unknown> & { id: string };

const columns: Column<Row>[] = [
  {
    key: "costing_number",
    header: "Costing #",
    render: (r) => String(r.costing_number ?? "—"),
  },
  { key: "entry_date", header: "Date", render: (r) => String(r.entry_date ?? "—") },
  { key: "yarn_cost", header: "Yarn", render: (r) => String(r.yarn_cost ?? "—") },
  {
    key: "labour_cost",
    header: "Labour",
    render: (r) => String(r.labour_cost ?? "—"),
  },
  { key: "power_cost", header: "Power", render: (r) => String(r.power_cost ?? "—") },
  {
    key: "maintenance_cost",
    header: "Maint.",
    render: (r) => String(r.maintenance_cost ?? "—"),
  },
  {
    key: "cost_per_meter",
    header: "₹/M",
    render: (r) => String(r.cost_per_meter ?? "—"),
  },
  { key: "meters", header: "Meters", render: (r) => String(r.meters ?? "—") },
];

const fields = [
  {
    name: "costing_number",
    label: "Costing number",
    type: "text" as const,
    required: true,
  },
  { name: "entry_date", label: "Date", type: "date" as const, required: true },
  { name: "yarn_cost", label: "Yarn cost", type: "number" as const },
  { name: "labour_cost", label: "Labour cost", type: "number" as const },
  { name: "power_cost", label: "Power cost", type: "number" as const },
  { name: "overhead_cost", label: "Overhead", type: "number" as const },
  { name: "maintenance_cost", label: "Maintenance cost", type: "number" as const },
  { name: "other_cost", label: "Other cost", type: "number" as const },
  {
    name: "cost_per_meter",
    label: "Cost per meter",
    type: "number" as const,
    required: true,
  },
  { name: "meters", label: "Meters", type: "number" as const, required: true },
  { name: "remarks", label: "Remarks", type: "textarea" as const },
];

export default function CostingPage() {
  return (
    <ModulePage
      title="Costing"
      subtitle="Article cost per meter and cost drivers."
      table="opa_costing_entries"
      moduleKey="costing"
      columns={columns}
      fields={fields}
      orderBy={{ column: "entry_date", ascending: false }}
      schema={costingFormSchema}
      createDefaults={() => {
        const d = new Date().toISOString().slice(0, 10);
        return {
          entry_date: d,
          costing_number: `CST-${d.replace(/-/g, "")}-NEW`,
          cost_per_meter: 0,
          meters: 0,
          yarn_cost: 0,
          labour_cost: 0,
          power_cost: 0,
          overhead_cost: 0,
          maintenance_cost: 0,
          other_cost: 0,
        };
      }}
    />
  );
}
